import { Texture, Vector2, Vector3 } from 'three';

export type TextureUniformValue = {
  value: Texture | null;
};
export type FloatUniformValue = {
  value: number;
};
export type IntUniformValue = {
  value: number;
};
export type Vector3UniformValue = {
  value: Vector3 | null;
};

export type Vector3ArrayUniformValue = {
  value: Vector3[] | null;
};
export type FloatArrayUniformValue = {
  value: number[] | null;
};
export type Vector2UniformValue = {
  value: Vector2 | null;
};
