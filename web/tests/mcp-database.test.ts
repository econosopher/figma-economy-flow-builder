import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { starter } from "../src/core/presets";
let db: PGlite;
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222";
async function user(owner: string, client?: string) {
  await db.exec("reset role;set role authenticated;");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: owner, ...(client ? { client_id: client } : {}) }),
  ]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role supabase_auth_admin;
    create schema auth;create schema storage;create table auth.users(id uuid primary key);
    insert into auth.users values('${alice}'),('${bob}');
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    grant usage on schema auth to authenticated,anon,service_role,supabase_auth_admin;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;`);
  for (const name of [
    "202609130001_economy_flow",
    "202609140001_diagram_visibility",
    "202609140002_mcp_catalog",
  ]) {
    await db.exec(
      readFileSync(
        new URL(`../supabase/migrations/${name}.sql`, import.meta.url),
        "utf8",
      ),
    );
  }
}, 30000);
afterAll(() => db.close());
describe("MCP database boundaries", () => {
  it("isolates accounts and denies unapproved OAuth clients, including direct PostgREST writes", async () => {
    await user(alice);
    await db.query("select save_document($1,$2,0,false)", [
      "alice-doc",
      { ...starter, id: "alice-doc", visibility: "private" },
    ]);
    await user(bob);
    expect((await db.query("select * from documents")).rows).toHaveLength(0);
    await user(alice, "unapproved");
    expect((await db.query("select * from documents")).rows).toHaveLength(0);
    await expect(
      db.query("select save_document($1,$2,1,false)", [
        "alice-doc",
        { ...starter, id: "alice-doc" },
      ]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into mcp_grants(owner_id,client_id,can_read,can_edit) values($1,$2,true,true)",
        [alice, "unapproved"],
      ),
    ).rejects.toThrow();
  });
  it("enforces read-only access and immediate revocation", async () => {
    await user(alice);
    await db.query(
      "insert into mcp_grants(owner_id,client_id,can_read) values($1,$2,true)",
      [alice, "reader"],
    );
    await user(alice, "reader");
    expect((await db.query("select * from documents")).rows).toHaveLength(1);
    await expect(
      db.query("select save_document($1,$2,1,false)", [
        "alice-doc",
        { ...starter, id: "alice-doc" },
      ]),
    ).rejects.toThrow();
    await expect(
      db.query("update mcp_grants set can_edit=true where client_id=$1", [
        "reader",
      ]),
    ).resolves.toMatchObject({ affectedRows: 0 });
    await user(alice);
    await db.query(
      "update mcp_grants set revoked_at=now() where client_id=$1",
      ["reader"],
    );
    await user(alice, "reader");
    expect((await db.query("select * from documents")).rows).toHaveLength(0);
  });
  it("saves once across retries, rejects stale or changed requests, and preserves owner checks", async () => {
    await user(alice);
    await db.query(
      "insert into mcp_grants(owner_id,client_id,can_read,can_edit) values($1,$2,true,true)",
      [alice, "editor"],
    );
    await user(alice, "editor");
    const params = [
      "33333333-3333-4333-8333-333333333333",
      "request-one",
      "alice-doc",
      { ...starter, id: "alice-doc", visibility: "public" },
      1,
    ];
    const first = await db.query(
      "select save_document_once($1,$2,$3,$4,$5,false) as result",
      params,
    );
    expect(first.rows[0]).toMatchObject({ result: { revision: 2 } });
    expect(
      (
        await db.query(
          "select save_document_once($1,$2,$3,$4,$5,false) as result",
          params,
        )
      ).rows,
    ).toEqual(first.rows);
    await expect(
      db.query("select save_document_once($1,$2,$3,$4,$5,false)", [
        params[0],
        "different",
        ...params.slice(2),
      ]),
    ).rejects.toThrow("Operation ID reused");
    await expect(
      db.query("select save_document_once($1,$2,$3,$4,$5,false)", [
        "44444444-4444-4444-8444-444444444444",
        ...params.slice(1),
      ]),
    ).rejects.toThrow("Revision conflict");
    await user(bob);
    await expect(
      db.query("select save_document_once($1,$2,$3,$4,$5,false)", [
        "55555555-5555-4555-8555-555555555555",
        "bob-request",
        "alice-doc",
        params[3],
        2,
      ]),
    ).rejects.toThrow("Revision conflict");
  });
});
describe("popularity catalog", () => {
  const presets = [
    { id: "z", title: "Zebra", description: "", created_at: "2026-09-13" },
    { id: "a", title: "Alpha", description: "", created_at: "2026-09-13" },
  ];
  async function browse(
    offset = 0,
    source = "all",
    sort = "most_viewed",
    search = "",
  ) {
    const r = await db.query<{
      result: { items: { id: string; views: number }[]; total: number };
    }>("select browse_catalog($1,$2,$3,$4,$5,1) as result", [
      presets,
      search,
      source,
      sort,
      offset,
    ]);
    return r.rows[0].result;
  }
  it("deduplicates daily views and sorts the complete dataset before pagination", async () => {
    await db.exec("reset role");
    expect(
      (
        await db.query("select record_catalog_view($1,$2,null) as accepted", [
          "preset:z",
          "visitor-one",
        ])
      ).rows[0],
    ).toEqual({ accepted: true });
    expect(
      (
        await db.query("select record_catalog_view($1,$2,null) as accepted", [
          "preset:z",
          "visitor-one",
        ])
      ).rows[0],
    ).toEqual({ accepted: false });
    await db.query("select record_catalog_view($1,$2,null)", [
      "preset:z",
      "visitor-two",
    ]);
    expect((await browse()).items[0]).toMatchObject({
      id: "preset:z",
      views: 2,
    });
    expect((await browse(1, "preset")).items[0]).toMatchObject({
      id: "preset:a",
      views: 0,
    });
    expect((await browse(0, "preset", "name")).items[0].id).toBe("preset:a");
    expect((await browse(0, "all", "most_viewed", "Alpha")).total).toBe(1);
  });
  it("excludes owner opens and removes locked or moderated publications without resetting counts", async () => {
    await db.exec("reset role");
    const publication = (
      await db.query<{ id: string }>(
        "select id from publications where document_id=$1",
        ["alice-doc"],
      )
    ).rows[0];
    const id = `publication:${publication.id}`;
    expect(
      (
        await db.query("select record_catalog_view($1,$2,$3) as accepted", [
          id,
          "owner",
          alice,
        ])
      ).rows[0],
    ).toEqual({ accepted: false });
    await db.query("select record_catalog_view($1,$2,null)", [id, "reader"]);
    await user(alice);
    await db.query("select save_document($1,$2,2,false)", [
      "alice-doc",
      { ...starter, id: "alice-doc", visibility: "private" },
    ]);
    await db.exec("reset role");
    expect((await browse(0, "community")).total).toBe(0);
    expect(
      (
        await db.query("select record_catalog_view($1,$2,null) as accepted", [
          id,
          "another",
        ])
      ).rows[0],
    ).toEqual({ accepted: false });
    await user(alice);
    await db.query("select save_document($1,$2,3,false)", [
      "alice-doc",
      { ...starter, id: "alice-doc", visibility: "public" },
    ]);
    await db.exec("reset role");
    expect((await browse(0, "community")).items[0]).toMatchObject({
      id,
      views: 1,
    });
    await db.query("update publications set hidden=true where id=$1", [
      publication.id,
    ]);
    expect((await browse(0, "community")).total).toBe(0);
  });
  it("prevents anonymous or OAuth clients from forging counters and catalog seeds", async () => {
    await db.exec("reset role;set role anon");
    await expect(
      db.query("select record_catalog_view($1,$2,null)", [
        "preset:z",
        "forged",
      ]),
    ).rejects.toThrow();
    await expect(browse()).rejects.toThrow();
    await user(alice, "editor");
    await expect(
      db.query("update catalog_counts set views=999"),
    ).rejects.toThrow();
    await expect(
      db.query("insert into mcp_saves values($1,$2,$3,$4,now())", [
        alice,
        "55555555-5555-4555-8555-555555555555",
        "x",
        {},
      ]),
    ).rejects.toThrow();
  });
});

describe("backup restoration", () => {
  it("restores documents, grants and counters with their access policies", async () => {
    await db.exec("reset role");
    const backup = await db.dumpDataDir();
    const restored = new PGlite({ loadDataDir: backup });
    try {
      expect(
        (await restored.query("select id,revision from documents order by id"))
          .rows,
      ).toEqual(
        (await db.query("select id,revision from documents order by id")).rows,
      );
      expect(
        (await restored.query("select * from catalog_counts order by item_id"))
          .rows,
      ).toEqual(
        (await db.query("select * from catalog_counts order by item_id")).rows,
      );
      await restored.exec("set role authenticated");
      await restored.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ sub: bob, client_id: "reader" }),
      ]);
      expect(
        (await restored.query("select * from documents")).rows,
      ).toHaveLength(0);
    } finally {
      await restored.close();
    }
  });
});
