// http://shaderfrog.com/view/4985
// forked from http://shaderfrog.com/view/3373
import { FloatUniformValue, Vector3UniformValue } from './star';
import { Vector3 } from 'three/src/math/Vector3';

export const fragmentShader = `

precision highp float;
precision highp int;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
uniform float time;
uniform float opacity;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec2 vUv2;
float Hash(vec2 p)
        {
            vec3 p2 = vec3(p.xy, 1.0);
            return fract(sin(dot(p2, vec3(37.1, 61.7, 12.4))) * 3758.5453123);
        }
float noise(in vec2 p)
        {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f *= f * (3.0 - 2.0 * f);
            return mix(mix(Hash(i + vec2(0., 0.)), Hash(i + vec2(1., 0.)), f.x), mix(Hash(i + vec2(0., 1.)), Hash(i + vec2(1., 1.)), f.x), f.y);
        }
float fbm(vec2 p)
        {
            float v = 0.0;
            v += noise(p * 1.0) * .5;
            v += noise(p * 2.) * .25;
            v += noise(p * 4.) * .125;
            return v * 1.0;
        }
const float PI = acos(0.0) * 2.0;
vec2 RadialCoords(vec3 a_coords)
        {
            vec3 a_coords_n = normalize(a_coords);
            float lon = atan(a_coords_n.z, a_coords_n.x);
            float lat = acos(a_coords_n.y);
            vec2 sphereCoords = vec2(lon, lat) / PI;
            return vec2(fract(sphereCoords.x * 0.5 + 0.5), 1.0 - sphereCoords.y);
        }
vec4 Lightning_main()
        {
            vec4 Lightning_gl_FragColor = vec4(0.0);
            vec2 uv = RadialCoords(vPosition * 1.0) * 2.0 - 1.0;
            vec3 finalColor = vec3(0.0);
            const float strength = 0.01;
            const float dx = 0.1;
            float t = 0.0;
            for (int k = -4;
 k < 14; ++k)
            {
                vec2 thisUV = uv;
                thisUV.x -= dx * float(k);
                thisUV.y -= float(k);
                t += abs(strength / (thisUV.x + fbm(thisUV + time)));
            }
            finalColor += t * vec3(0.1, 0.3, 1.0);
            Lightning_gl_FragColor = vec4(finalColor, opacity);
            return Lightning_gl_FragColor;
        }
vec4 Electric_Shader1556488915096_215_main()
        {
            vec4 Electric_Shader1556488915096_215_gl_FragColor = vec4(0.0);
            Electric_Shader1556488915096_215_gl_FragColor = Lightning_main();
            return Electric_Shader1556488915096_215_gl_FragColor *= 1.0;
        }
void main()
        {
            gl_FragColor = Electric_Shader1556488915096_215_main();
        }
`;
export const vertexShader = `

precision highp float;
precision highp int;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
uniform float time;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec2 uv2;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec2 vUv2;
vec4 Lightning_main()
        {
            vec4 Lightning_gl_Position = vec4(0.0);
            vNormal = normal;
            vUv = uv;
            vUv2 = uv2;
            vPosition = position;
            Lightning_gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            return Lightning_gl_Position *= 0.5;
        }
vec4 Electric_Shader1556488915096_215_main()
        {
            vec4 Electric_Shader1556488915096_215_gl_Position = vec4(0.0);
            Electric_Shader1556488915096_215_gl_Position = Lightning_main();
            return Electric_Shader1556488915096_215_gl_Position *= 1.0;
        }
void main()
        {
            gl_Position = Electric_Shader1556488915096_215_main();        }
`;

export const uniforms: {
  cameraPosition: Vector3UniformValue;
  time: FloatUniformValue;
  opacity: FloatUniformValue;
} = {
  cameraPosition: { value: new Vector3(0, 0, 0) },
  time: { value: 0 },
  opacity: { value: 1 },
};
