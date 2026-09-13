import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
let db: PGlite;
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222";
async function asUser(id: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key);insert into auth.users values('${alice}'),('${bob}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;`,
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202609130001_economy_flow.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202609140001_diagram_visibility.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(() => db.close());
describe("database authorization and snapshot boundaries", () => {
  it("allows owner save but rejects stale revisions and cross-account reads", async () => {
    await asUser(alice);
    await db.query(`select public.save_document($1,$2,0,false)`, [
      "diagram-a",
      { id: "diagram-a", schemaVersion: 3, name: "Private draft" },
    ]);
    const a = await db.query("select * from public.documents");
    expect(a.rows).toHaveLength(1);
    await expect(
      db.query(`select public.save_document($1,$2,0,false)`, [
        "diagram-a",
        { id: "diagram-a", schemaVersion: 3 },
      ]),
    ).rejects.toThrow("Revision conflict");
    await asUser(bob);
    expect(
      (await db.query("select * from public.documents")).rows,
    ).toHaveLength(0);
    await expect(
      db.query(`select public.save_document($1,$2,1,false)`, [
        "diagram-a",
        { id: "diagram-a", schemaVersion: 3, name: "Hijacked" },
      ]),
    ).rejects.toThrow("Revision conflict");
  });
  it("exposes published snapshots, not private documents or credentials", async () => {
    await db.exec("reset role");
    await db.query(
      `insert into public.publications(owner_id,document_id,title,author,snapshot) values($1,'diagram-a','Published version','Alice',$2)`,
      [alice, { name: "Snapshot" }],
    );
    await db.exec("set role anon");
    expect(
      (await db.query("select title,snapshot from public.publications")).rows,
    ).toHaveLength(1);
    await expect(db.query("select * from public.documents")).rejects.toThrow();
    await expect(
      db.query("select * from public.job_credentials"),
    ).rejects.toThrow();
    await expect(
      db.query("select * from public.slack_installations"),
    ).rejects.toThrow();
  });
  it("private edits do not alter published snapshots; users cannot bypass moderation", async () => {
    await asUser(alice);
    await db.query(`select public.save_document($1,$2,1,false)`, [
      "diagram-a",
      { id: "diagram-a", schemaVersion: 3, name: "Later private edit" },
    ]);
    expect(
      (
        await db.query<{ snapshot: { name: string } }>(
          "select snapshot from public.publications",
        )
      ).rows[0].snapshot.name,
    ).toBe("Snapshot");
    await expect(
      db.exec("update public.publications set hidden=false"),
    ).rejects.toThrow();
    await db.exec(
      "reset role;update public.publications set hidden=true;set role anon;select set_config('request.jwt.claim.sub','',false);",
    );
    expect(
      (await db.query("select * from public.publications")).rows,
    ).toHaveLength(0);
  });
  it("revokes share access without altering the source diagram", async () => {
    await db.exec("reset role");
    await db.query(
      `insert into public.share_links(owner_id,document_id,token_hash,snapshot) values($1,'diagram-a','randomhash',$2)`,
      [alice, { name: "Shared snapshot" }],
    );
    await asUser(bob);
    expect(
      (await db.query("select * from public.share_links")).rows,
    ).toHaveLength(0);
    await asUser(alice);
    expect(
      (await db.query("select * from public.share_links")).rows,
    ).toHaveLength(1);
    await db.exec("delete from public.share_links");
    expect(
      (await db.query("select * from public.share_links")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.documents")).rows,
    ).toHaveLength(1);
  });
  it("can back up and restore document rows into an isolated recovery table", async () => {
    await db.exec("reset role");
    const backup = await db.query("select * from public.documents");
    await db.exec(
      "create table recovery_documents (like public.documents including all)",
    );
    for (const row of backup.rows as Record<string, unknown>[])
      await db.query(
        "insert into recovery_documents(id,owner_id,document,revision,is_preset,updated_at) values($1,$2,$3,$4,$5,$6)",
        [
          row.id,
          row.owner_id,
          row.document,
          row.revision,
          row.is_preset,
          row.updated_at,
        ],
      );
    expect(
      (await db.query("select id,document,revision from recovery_documents"))
        .rows,
    ).toEqual(
      (await db.query("select id,document,revision from public.documents"))
        .rows,
    );
  });
});

describe("automatic gallery visibility", () => {
  const doc = (visibility: string, name = "Community economy") => ({
    id: "automatic-a",
    schemaVersion: 3,
    name,
    visibility,
    cards: [{ id: "card" }],
  });
  it("publishes with an owner save and updates the same snapshot", async () => {
    await asUser(alice);
    await db.query("select public.save_document($1,$2,0,false)", [
      "automatic-a",
      doc("public"),
    ]);
    await db.exec(
      "reset role;set role anon;select set_config('request.jwt.claim.sub','',false)",
    );
    const rows = (
      await db.query<{ id: string; snapshot: { name: string } }>(
        "select id,snapshot from publications where document_id='automatic-a'",
      )
    ).rows;
    expect(rows).toHaveLength(1);
    await asUser(alice);
    await db.query("select public.save_document($1,$2,1,false)", [
      "automatic-a",
      doc("public", "Edited public economy"),
    ]);
    expect(
      (
        await db.query<{ id: string; snapshot: { name: string } }>(
          "select id,snapshot from publications where document_id='automatic-a'",
        )
      ).rows[0],
    ).toMatchObject({
      id: rows[0].id,
      snapshot: { name: "Edited public economy" },
    });
  });
  it("locks atomically and rejects stale saves and foreign owners", async () => {
    await asUser(alice);
    await db.query("select public.save_document($1,$2,2,false)", [
      "automatic-a",
      doc("private"),
    ]);
    await expect(
      db.query("select public.save_document($1,$2,2,false)", [
        "automatic-a",
        doc("public"),
      ]),
    ).rejects.toThrow("Revision conflict");
    await asUser(bob);
    await expect(
      db.query("select public.save_document($1,$2,3,false)", [
        "automatic-a",
        doc("public"),
      ]),
    ).rejects.toThrow("Revision conflict");
    await db.exec(
      "reset role;set role anon;select set_config('request.jwt.claim.sub','',false)",
    );
    expect(
      (
        await db.query(
          "select * from publications where document_id='automatic-a'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("prevents a stale legacy publication from bypassing a lock", async () => {
    await db.exec("reset role");
    await expect(
      db.query(
        "update publications set snapshot=$1,listed=true where document_id='automatic-a'",
        [doc("public")],
      ),
    ).rejects.toThrow("Use the diagram lock");
    expect(
      (
        await db.query<{ listed: boolean }>(
          "select listed from publications where document_id='automatic-a'",
        )
      ).rows[0].listed,
    ).toBe(false);
  });
  it("unlocks without undoing moderator removal", async () => {
    await db.exec(
      "reset role;update publications set hidden=true where document_id='automatic-a'",
    );
    await asUser(alice);
    await db.query("select public.save_document($1,$2,3,false)", [
      "automatic-a",
      doc("public"),
    ]);
    await db.exec(
      "reset role;set role anon;select set_config('request.jwt.claim.sub','',false)",
    );
    expect(
      (
        await db.query(
          "select * from publications where document_id='automatic-a'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("keeps private and empty new documents out of the gallery", async () => {
    await asUser(alice);
    await db.query("select public.save_document($1,$2,0,false)", [
      "private-new",
      { ...doc("private"), id: "private-new" },
    ]);
    await db.query("select public.save_document($1,$2,0,false)", [
      "empty-new",
      { ...doc("public"), id: "empty-new", cards: [] },
    ]);
    await db.exec("reset role");
    expect(
      (
        await db.query(
          "select * from publications where document_id in ('private-new','empty-new')",
        )
      ).rows,
    ).toHaveLength(0);
  });
});
