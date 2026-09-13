import { describe,it,expect } from 'vitest';
import { blankDocument,addCard,validateDocument,forkDocument,deleteCard,cardFingerprint,evidenceNeedsReview } from '../src/core/document';
function fixture() {
 let d=addCard(blankDocument());const id=d.cards[0].id;
 d.evidence={details:[{cardId:id,explanation:'Pay a player to revive you.',implications:'A transfer, not a new cash source.',prompt:'Who receives it?',status:'unverified',uncertainties:['Settlement unverified'],reviewFingerprint:cardFingerprint(d,id)}],items:[{id:'source',cardIds:[id],kind:'youtube',title:'Developer mechanics',url:'https://www.youtube.com/watch?v=PQvtvAvl-78',videoId:'PQvtvAvl-78',timestampSeconds:159,caption:'Announced metagame'}]};
 return d;
}
describe('card evidence compatibility and review',()=>{
 it('preserves full evidence through JSON import and copying without changing private visibility',()=>{
  const d={...fixture(),visibility:'private' as const};const restored=validateDocument(JSON.parse(JSON.stringify(d)));const copy=forkDocument(restored);
  expect(copy.evidence).toEqual(d.evidence);expect(copy.id).not.toBe(d.id);expect(copy.visibility).toBe('private');expect(evidenceNeedsReview(copy,copy.cards[0].id)).toBe(false);
 });
 it('marks semantic edits for review, but not layout and title changes',()=>{
  const d=fixture();const id=d.cards[0].id;
  expect(evidenceNeedsReview({...d,name:'New diagram title',cards:d.cards.map(c=>({...c,order:88}))},id)).toBe(false);
  expect(evidenceNeedsReview({...d,cards:d.cards.map(c=>({...c,sinks:['Real money']}))},id)).toBe(true);
 });
 it('removes deleted-card mappings while retaining evidence shared by other cards',()=>{
  let d=addCard(fixture());const id=d.cards[0].id;d.evidence!.items[0].cardIds.push(d.cards[1].id);
  const next=validateDocument(deleteCard(d,id));expect(next.evidence!.details).toHaveLength(0);expect(next.evidence!.items[0].cardIds).toEqual([d.cards[1].id]);
  expect(validateDocument(deleteCard(next,next.cards[0].id)).evidence!.items).toHaveLength(0);
 });
 it('rejects mismatched videos, invalid timestamps, scripts, missing images and orphan mappings',()=>{
  const d=fixture();const item=d.evidence!.items[0];
  for(const patch of [{videoId:'aaaaaaaaaaa'},{timestampSeconds:-1},{endSeconds:10},{url:'javascript:alert(1)'},{kind:'image',mediaId:undefined},{cardIds:['absent']}]) {
   expect(()=>validateDocument({...d,evidence:{...d.evidence,items:[{...item,...patch}]}})).toThrow();
  }
 });
 it('loads legacy diagrams with no evidence',()=>expect(validateDocument(blankDocument()).evidence).toBeUndefined());
});
