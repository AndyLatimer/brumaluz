import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { prune } from '@gltf-transform/functions';

const asset = fileURLToPath(new URL('../src/assets/models/wardrobe/helpers.glb', import.meta.url));
test('helpers wardrobe is an independent, bounded, compatible GLB with normalized skinning', async () => {
  const io = new NodeIO();
  const document = await io.read(asset);
  const reference = await io.read(fileURLToPath(new URL('../src/assets/models/Mage.glb', import.meta.url)));
  const root = document.getRoot(), skin = root.listSkins()[0];
  assert.deepEqual(skin.listJoints().map(j => j.getName()), reference.getRoot().listSkins()[0].listJoints().map(j => j.getName()));
  assert.deepEqual(Array.from(skin.getInverseBindMatrices().getArray()), Array.from(reference.getRoot().listSkins()[0].getInverseBindMatrices().getArray()));
  assert.equal(skin.listJoints().length, 41);
  assert.equal(root.listAnimations().length, 0, 'Animations belong to the shared character, not each outfit');
  assert.ok((await readFile(asset)).length < 600_000, 'Equipment asset remains small');
  const expected = [
    'helpers-shirt','helpers-sleeve-l','helpers-sleeve-r','helpers-overalls',
    'helpers-trouser-l','helpers-trouser-r','helpers-boot-l','helpers-boot-r',
    'helpers-soft-cap','anatomy-hand-left','anatomy-hand-right',
  ];
  assert.deepEqual(root.listMeshes().map(m => m.getName()).sort(), [...expected].sort());
  let triangles = 0;
  for (const node of root.listNodes().filter(n => n.getMesh())) {
    assert.ok(!/Mage_|Rogue_/.test(node.getName()), 'No borrowed clothing or deformed wizard hat');
    let crownHeight = 0;
    for (const primitive of node.getMesh().listPrimitives()) {
      const positions = primitive.getAttribute('POSITION');
      assert.ok(positions.getCount() > 0);
      assert.ok(Array.from(positions.getArray()).every(Number.isFinite));
      triangles += (primitive.getIndices()?.getCount() ?? positions.getCount()) / 3;
      if (node.getName() === 'helpers-soft-cap') {
        assert.equal(node.getSkin(), null);
        assert.equal(node.getExtras().attachment, 'head');
        assert.equal(node.getParentNode().getName(), 'head', 'The editable GLB also shows the hat on the head');
        const min = positions.getMin([]), max = positions.getMax([]);
        assert.ok(max[0] - min[0] < 1, 'No broad wizard brim');
        crownHeight = Math.max(crownHeight, max[1]);
      } else {
        assert.equal(node.getSkin(), skin);
        const indices = primitive.getAttribute('JOINTS_0'), weights = primitive.getAttribute('WEIGHTS_0');
        assert.equal(weights.getCount(), positions.getCount());
        for (let i = 0; i < weights.getCount(); i++) {
          const w = weights.getElement(i, []), j = indices.getElement(i, []);
          assert.ok(Math.abs(w.reduce((a,b) => a+b, 0) - 1) < .00001);
          assert.ok(w.every(value => value >= 0 && value <= 1));
          assert.ok(j.every(index => index >= 0 && index < 41));
        }
      }
    }
    if (node.getName() === 'helpers-soft-cap') assert.ok(crownHeight > 1.2, 'Tall soft crown');
  }
  assert.ok(triangles < 15_000, `Outfit triangle budget: ${triangles}`);
});

test('boot soles are closed opaque volumes with outward-facing bottom caps', async () => {
  const document = await new NodeIO().read(asset);
  for (const side of ['l','r']) {
    const node = document.getRoot().listNodes().find(n => n.getName() === `helpers-boot-${side}`);
    const sole = node.getMesh().listPrimitives().find(p => p.getMaterial().getName() === 'sole');
    assert.equal(sole.getMaterial().getAlphaMode(), 'OPAQUE');
    assert.equal(sole.getMaterial().getDoubleSided(), false, 'Do not hide holes with two-sided rendering');
    const positions = sole.getAttribute('POSITION'), indices = sole.getIndices(), edges = new Map();
    const key = index => positions.getElement(index, []).map(v => Math.round(v*1e6)).join(',');
    let bottomTriangles = 0;
    for (let i=0; i<indices.getCount(); i+=3) {
      const triangle = [0,1,2].map(offset => indices.getScalar(i+offset));
      for (let edge=0; edge<3; edge++) {
        const a=key(triangle[edge]),b=key(triangle[(edge+1)%3]);
        const id=[a,b].sort().join('|');
        const entry=edges.get(id)??{count:0,direction:0};
        entry.count++;entry.direction+=a<b?1:-1;edges.set(id,entry);
      }
      const vertices = triangle.map(index => new THREE.Vector3(...positions.getElement(index, [])));
      if (vertices.every(v => Math.abs(v.y-.012)<1e-6)) {
        const normal = new THREE.Triangle(...vertices).getNormal(new THREE.Vector3());
        assert.ok(normal.y<-.99, 'Bottom faces are visible when viewed from below');
        bottomTriangles++;
      }
    }
    assert.equal(bottomTriangles,32);
    assert.ok([...edges.values()].every(edge=>edge.count===2&&edge.direction===0), 'Sole has no open edges or inverted neighbors');
  }
});

test('bib and straps follow the shirt surface rather than floating on an independent shell', async () => {
  const document = await new NodeIO().read(asset);
  const nodes = document.getRoot().listNodes();
  const shirt = nodes.find(node=>node.getName()==='helpers-shirt').getMesh().listPrimitives()[0];
  const trianglesOf = primitive => {
    const positions=primitive.getAttribute('POSITION'),indices=primitive.getIndices(),triangles=[];
    for(let i=0;i<indices.getCount();i+=3) {
      triangles.push(new THREE.Triangle(...[0,1,2].map(offset=>
        new THREE.Vector3(...positions.getElement(indices.getScalar(i+offset),[])))));
    }
    return triangles;
  };
  const triangles=trianglesOf(shirt);
  const shoulders=[...triangles,...['l','r'].flatMap(side=>trianglesOf(
    nodes.find(node=>node.getName()===`helpers-sleeve-${side}`).getMesh().listPrimitives()[0]))];
  const primitives=nodes.find(node=>node.getName()==='helpers-overalls').getMesh().listPrimitives();
  for(const index of [1,2,4]) {
    const vertices=primitives[index].getAttribute('POSITION');
    for(let i=0;i<vertices.getCount();i++) {
      const point=new THREE.Vector3(...vertices.getElement(i,[])),closest=new THREE.Vector3();
      if(point.y<.85)continue; // The shirt tail is deliberately absent beneath the waist.
      const target=index===1?triangles:shoulders;
      const distance=Math.min(...target.map(triangle=>point.distanceTo(triangle.closestPointToPoint(point,closest))));
      assert.ok(distance>.002&&distance<.015,`Panel ${index}, vertex ${i} clearance: ${distance}`);
      if(index!==1)assert.ok(Math.abs(point.x)<.20,'Straps stay on the chest-weighted shoulder, inside the moving upper arm');
    }
  }
});

test('shoulders, wrists, crotch and waistband remain joined throughout locomotion and gestures', async () => {
  const io = new NodeIO(), reference = await io.read(fileURLToPath(new URL('../src/assets/models/Mage.glb', import.meta.url)));
  for (const node of [...reference.getRoot().listNodes()]) if (node.getMesh()) node.dispose();
  await reference.transform(prune());
  const loader = new GLTFLoader();
  const bytes = await readFile(asset);
  const outfit = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const animationBytes = await io.writeBinary(reference);
  const animations = (await loader.parseAsync(animationBytes.buffer.slice(animationBytes.byteOffset,animationBytes.byteOffset+animationBytes.byteLength),'')).animations;
  const mixer = new THREE.AnimationMixer(outfit.scene);
  const torso = outfit.scene.getObjectByName('helpers-shirt');
  const torsoMesh = torso.isSkinnedMesh ? torso : torso.children.find(child=>child.isSkinnedMesh);
  const bone = outfit.scene.getObjectByName('chest');
  for (const clipName of ['Idle','Walking_A','Running_A','Cheer','Interact']) {
    const clip = animations.find(clip=>clip.name===clipName);
    assert.ok(clip,clipName);
    const action = mixer.clipAction(clip).play();
    for (let frame=0;frame<=16;frame++) {
      mixer.setTime(clip.duration*frame/16);
      outfit.scene.updateMatrixWorld(true);
      outfit.scene.traverse(object=>{if(object.isSkinnedMesh)object.skeleton.update();});
      const pants=['l','r'].map(side=>outfit.scene.getObjectByName(`helpers-trouser-${side}`));
      const overall=outfit.scene.getObjectByName('helpers-overalls');
      const waistband=overall.isSkinnedMesh?overall:overall.children.find(child=>child.isSkinnedMesh);
      const waist=[];
      for(let i=0;i<waistband.geometry.getAttribute('position').count;i++){
        if(Math.abs(waistband.geometry.getAttribute('position').getY(i)-.62)<1e-5)waist.push(waistband.getVertexPosition(i,new THREE.Vector3()));
      }
      for(let col=0;col<=32;col++){
        const a=8*33+col,b=a;
        const position=pants[0].geometry.getAttribute('position');
        if(Math.abs(position.getX(a))<1e-5){
          assert.ok(pants[0].getVertexPosition(a,new THREE.Vector3()).distanceTo(pants[1].getVertexPosition(b,new THREE.Vector3()))<1e-5,`${clipName}: crotch seam stays closed`);
        }else{
          for(const leg of pants){
            const point=leg.getVertexPosition(a,new THREE.Vector3());
            assert.ok(waist.some(vertex=>point.distanceTo(vertex)<1e-5),`${clipName}: leg meets the waistband without a gap`);
          }
        }
      }
      for (const [side,sign,label] of [['l',1,'left'],['r',-1,'right']]) {
        const sleeve=outfit.scene.getObjectByName(`helpers-sleeve-${side}`);
        const hand=outfit.scene.getObjectByName(`anatomy-hand-${label}`);
        const source=sleeve.geometry.getAttribute('position');
        const cuff=[],shoulder=[];
        for(let i=0;i<source.count;i++){
          if(Math.abs(source.getX(i)-sign*.81)<1e-5)cuff.push(sleeve.getVertexPosition(i,new THREE.Vector3()));
          if(Math.abs(source.getX(i)-sign*.08)<1e-5)shoulder.push(sleeve.getVertexPosition(i,new THREE.Vector3()));
        }
        const handPositions=hand.geometry.getAttribute('position'),wrist=[];
        for(let i=0;i<handPositions.count;i++){
          if(Math.abs(handPositions.getX(i)-sign*.7985565)<1e-4)wrist.push(hand.getVertexPosition(i,new THREE.Vector3()));
        }
        assert.ok(cuff.length>0&&wrist.length>0);
        const gap=Math.max(...wrist.map(point=>Math.min(...cuff.map(other=>point.distanceTo(other)))));
        assert.ok(gap<.04,`${clipName} ${side} frame ${frame}: wrist/cuff gap ${gap}`);
        // The sleeve's inner ring must follow exactly the chest, not pivot away with the arm.
        for(let i=0;i<source.count;i++){
          if(Math.abs(source.getX(i)-sign*.08)>1e-5)continue;
          const joints=sleeve.geometry.getAttribute('skinIndex'),weights=sleeve.geometry.getAttribute('skinWeight');
          assert.equal(sleeve.skeleton.bones[joints.getX(i)],bone);
          assert.equal(weights.getX(i),1);
        }
        const center=shoulder.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/shoulder.length);
        const torsoPoints=[];
        for(let i=0;i<torsoMesh.geometry.getAttribute('position').count;i++)torsoPoints.push(torsoMesh.getVertexPosition(i,new THREE.Vector3()));
        assert.ok(torsoPoints.some(point=>point.distanceTo(center)<.28),`${clipName}: shoulder stays within the shirt`);
      }
    }
    action.stop();mixer.setTime(0);
  }
});
