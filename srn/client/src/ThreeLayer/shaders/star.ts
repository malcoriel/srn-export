import { Texture, Vector2, Vector3 } from 'three';

// delete viewMatrix, cameraPosition

export let vertexShader = `
/**
* Example Vertex Shader
* Sets the position of the vertex by setting gl_Position
*/

// Set the precision for data types used in this shader
precision highp float;
precision highp int;

// Default THREE.js uniforms available to both fragment and vertex shader
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;

// Default uniforms provided by ShaderFrog.
uniform vec3 cameraPosition;
uniform float time;

// Default attributes provided by THREE.js. Attributes are only available in the
// vertex shader. You can pass them to the fragment shader using varyings
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec2 uv2;

// Examples of variables passed from vertex to fragment shader
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec2 vUv2;

void main() {

    // To pass variables to the fragment shader, you assign them here in the
    // main function. Traditionally you name the varying with vAttributeName
    vNormal = normal;
    vUv = uv;
    vUv2 = uv2;
    vPosition = position;

    // This sets the position of the vertex in 3d space. The correct math is
    // provided below to take into account camera and object data.
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}
    `;
export let fragmentShader = `
// Set the precision for data types used in this shader
precision highp float;
precision highp int;

// Default THREE.js uniforms available to both fragment and vertex shader
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;

// Default uniforms provided by ShaderFrog.
uniform vec3 cameraPosition;
uniform float time;
uniform float fixedTime;

// A uniform unique to this shader. You can modify it to the using the form
// below the shader preview. Any uniform you add is automatically given a form
uniform vec3 color;

// Example varyings passed from the vertex shader
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec2 vUv2;

// https://www.shadertoy.com/view/4dXGR4

precision highp float;
precision highp int;
uniform vec3      iResolution;           // viewport resolution (in pixels)
uniform sampler2D iChannel0;          // input channel. XX = 2D/Cube
uniform sampler2D iChannel1;          // input channel. XX = 2D/Cube
uniform float srcRadius;
uniform float fCenter;
uniform vec2 shift;

vec4 texture2(sampler2D sampler, vec2 coord){
    return texture2D(sampler,  coord);
}

float snoise(vec3 uv, float res)// by trisomie21
{
const vec3 s = vec3(1e0, 1e2, 1e4);

uv *= res;

vec3 uv0 = floor(mod(uv, res))*s;
vec3 uv1 = floor(mod(uv+vec3(1.), res))*s;

vec3 f = fract(uv); f = f*f*(3.0-2.0*f);

vec4 v = vec4(uv0.x+uv0.y+uv0.z, uv1.x+uv0.y+uv0.z,
        uv0.x+uv1.y+uv0.z, uv1.x+uv1.y+uv0.z);

vec4 r = fract(sin(v*1e-3)*1e5);
float r0 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);

r = fract(sin((v + uv1.z - uv0.z)*1e-3)*1e5);
float r1 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);

return mix(r0, r1, f.z)*2.-1.;
}

float freqs[4];

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragCoord += shift;
freqs[0] = texture2( iChannel1, vec2( 0.01, 0.25 ) ).x;
freqs[1] = texture2( iChannel1, vec2( 0.07, 0.25 ) ).x;
freqs[2] = texture2( iChannel1, vec2( 0.15, 0.25 ) ).x;
freqs[3] = texture2( iChannel1, vec2( 0.30, 0.25 ) ).x;

    float brightness= freqs[1] * 0.25 + freqs[2] * 0.25;
    vec3 orange= color * 1.1;
vec3 orangeRed= color / 2.0;
float time= time * 0.04;


    float radiusB = 0.24 * srcRadius;
    float radiusK = 0.2 * srcRadius;
    float radiusO = 2.0 / srcRadius;
    float radiusC = 2.0 / srcRadius;
    vec2 srcCenter = vec2(fCenter);
    float spXCenter = srcCenter.x * 2.0;
    float spYCenter = srcCenter.x * 2.0;


float radius= radiusB + brightness * radiusK;
float invRadius = 1.0/radius;

float aspect= iResolution.x/iResolution.y;
vec2 uv= fragCoord.xy / iResolution.xy;
vec2 center_offset = uv - srcCenter;
center_offset.x *= aspect;

float fade= pow( length( 1.9 * center_offset ), 0.55 );
float fVal1= 1.0 - fade;
float fVal2= 1.0 - fade;

float angle= atan( center_offset.x, center_offset.y )/6.2832;
float dist= length(center_offset);
vec3 coord= vec3( angle, dist, time * 0.1 );

float newTime1= abs( snoise( coord + vec3( 0.0, -time * ( 0.35 + brightness * 0.001 ), time * 0.015 ), 15.0 ) );
float newTime2= abs( snoise( coord + vec3( 0.0, -time * ( 0.15 + brightness * 0.001 ), time * 0.015 ), 45.0 ) );
for( int i=1; i<=7; i++ ){
float power = pow( 2.0, float(i + 1) );
fVal1 += ( 0.5 / power ) * snoise( coord + vec3( 0.0, -time, time * 0.2 ), ( power * ( 10.0 ) * ( newTime1 + 1.0 ) ) );
fVal2 += ( 0.5 / power ) * snoise( coord + vec3( 0.0, -time, time * 0.2 ), ( power * ( 25.0 ) * ( newTime2 + 1.0 ) ) );
}

float corona= pow( fVal1 * max( 1.1 - fade, 0.0 ), radiusC ) * 50.0;
corona+= pow( fVal2 * max( 1.1 - fade, 0.0 ), radiusC ) * 50.0;
corona*= 1.2 - newTime1;
vec3 sphereNormal = vec3( 0.0, 0.0, 1.0 );
vec3 dir = vec3( 0.0 );
vec3 center= vec3( 0.5, 0.5, 1.0 );
vec3 starSphere= vec3( 0.0 );



// outline
vec2 sp = vec2(0);
sp.x += -spXCenter + 2.0 * uv.x;
sp.y += -spYCenter + 2.0 * uv.y;
sp.x *= aspect;
sp *= ( radiusO - brightness );
  float r = dot((sp),(sp));
  float fbase = (1.0-sqrt(abs(1.0-r)))/(r) + brightness * 0.5;
if( dist < radius ){
corona*= pow( dist * invRadius, 24.0 );
  vec2 newUv;
 newUv.x = sp.x*fbase;
  newUv.y = sp.y*fbase;
newUv += vec2( time, 0.0 );
// starSphere = vec3(newUv, 0);

vec3 texSample = texture2( iChannel0, newUv ).rgb;
float uOff= ( texSample.g * brightness * 4.5 + time );
//starSphere = vec3(uOff, 0.0, 0.0);
 vec2 starUV= newUv + vec2( uOff, 0.0 );
 starSphere= texture2( iChannel0, starUV ).rgb;
}

float starGlow= min( max( 1.0 - dist * ( 1.0 - brightness ), 0.0 ), 1.0 );
fragColor.rgb = vec3(0, 0, 0);
// outline (like in eclipse)
fragColor.rgb += vec3( fbase * ( 0.75 + brightness * 0.3 ) * orange );
// rotating texture
fragColor.rgb+= starSphere;
// corona
fragColor.rgb   += corona * orange;
// emitted light
fragColor.rgb   += starGlow * orangeRed;
fragColor.a= 1.0;
// fragColor.rgba = vec4(vNormal * 0.5 + 0.5, 1);
// fragColor.rgb = vec3(time / 800.0);
}

void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}




        `;

export type TextureUniformValue = {
  value: Texture | null;
};

export type FloatUniformValue = {
  value: number;
};

export type Vector3UniformValue = {
  value: Vector3 | null;
};

export type Vector2UniformValue = {
  value: Vector2 | null;
};

export let uniforms: {
  iChannel0: TextureUniformValue;
  time: FloatUniformValue;
  iChannel1: TextureUniformValue;
  iResolution: Vector3UniformValue;
  srcRadius: FloatUniformValue;
  fCenter: FloatUniformValue;
  color: Vector3UniformValue;
  shift: Vector2UniformValue;
} = {
  iChannel0: { value: null },
  time: { value: 0 },
  srcRadius: { value: 0.32 },
  fCenter: { value: 0.5 },
  iChannel1: { value: null },
  iResolution: { value: new Vector3(700, 700, 0) },
  color: { value: new Vector3(0, 0, 0) },
  shift: { value: new Vector2(0, 0) },
};
