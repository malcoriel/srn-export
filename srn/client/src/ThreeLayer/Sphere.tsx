import React, { Suspense, useRef, useState } from 'react';
import { MeshProps, useFrame, useLoader } from 'react-three-fiber';
import { Color, Mesh, MeshBasicMaterial, TextureLoader } from 'three';
import { CellularNoiseMaterial } from 'threejs-shader-materials';
import { Material } from 'three/src/materials/Material';

const generalPurposeVertexShader = `
varying vec2 vUv;
void main()
{
    vUv = uv;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
}
`;
const noiseMaterial = new CellularNoiseMaterial();
noiseMaterial.isAnimate = true;
noiseMaterial.grid = 20;
noiseMaterial.divisionScaleX = 2;
noiseMaterial.speed = 2;

export const Sphere: React.FC<
  MeshProps & { color?: string; star?: boolean }
> = (props) => {
  // This reference will give us direct access to the mesh
  const mesh = useRef<Mesh>();
  const space01map = useLoader(TextureLoader, 'resources/space01.jpg');
  const color = props.color || 'white';

  // useFrame(() => {
  //   if (mesh.current) mesh.current.rotation.y = mesh.current.rotation.y += 0.02;
  // });

  let starMaterial: Material | undefined;
  if (props.star) {
    noiseMaterial.color = new Color(color);
    starMaterial = noiseMaterial;
  } else {
    starMaterial = new MeshBasicMaterial({
      color,
      map: space01map,
    });
  }

  return (
    <mesh
      {...props}
      ref={mesh}
      rotation={[Math.PI / 2, Math.PI, 0]}
      material={starMaterial}
    >
      <icosahedronBufferGeometry args={[1, 5]} />
    </mesh>
  );
};
