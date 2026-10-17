import test from 'node:test';
import assert from 'node:assert/strict';
import {safeUploadType,reportContent,grantInput} from '../src/lib/secure-validation.ts';
test('upload content detection rejects HTML and misleading extensions',()=>{
 assert.equal(safeUploadType(new TextEncoder().encode('<script>alert(1)</script>')),null);
 assert.equal(safeUploadType(new TextEncoder().encode('%PDF-1.7')), 'application/pdf');
 assert.equal(safeUploadType(new Uint8Array([137,80,78,71,13,10,26,10])), 'image/png');
 assert.equal(safeUploadType(new Uint8Array([255,216,255])), 'image/jpeg');
 assert.equal(safeUploadType(new Uint8Array()),null);
});
test('manual review requires source provenance for every observation',()=>{
 assert.equal(reportContent.safeParse({notes:'',observations:[{label:'Creatinine',value:'1.1',unit:'mg/dL'}]}).success,false);
 assert.equal(reportContent.safeParse({notes:'',observations:[{label:'Creatinine',value:'1.1',unit:'mg/dL',sourceExcerpt:'Creatinine 1.1 mg/dL',sourcePage:1}]}).success,true);
});
test('consent rejects missing versions, non-UUID recipient and excessive duration',()=>{
 const base={recipient:'00000000-0000-4000-8000-000000000002',purpose:'Consultation',versions:['00000000-0000-4000-8000-000000000003'],hours:24};
 assert.equal(grantInput.safeParse(base).success,true);
 for(const patch of [{versions:[]},{recipient:'doctor@example.com'},{hours:721},{hours:-1}])assert.equal(grantInput.safeParse({...base,...patch}).success,false);
});
