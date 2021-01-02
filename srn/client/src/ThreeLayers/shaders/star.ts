import { Texture, Vector2, Vector3 } from 'three';
import { size } from '../../world';

// delete viewMatrix, cameraPosition

export let vertexShader = `precision highp float;
precision highp int;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float time;

attribute vec3 position;

void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}`;
export let fragmentShader = `// Set the precision for data types used in this shader
precision highp float;
precision highp int;
uniform float time;
uniform vec3 color;

// https://www.shadertoy.com/view/4dXGR4
uniform vec3      iResolution;           // viewport resolution (in pixels)
uniform sampler2D iChannel0;          // input channel. XX = 2D/Cube
uniform sampler2D iChannel1;          // input channel. XX = 2D/Cube
uniform float srcRadius;
uniform float fCenter;
uniform vec2 shift;

vec4 texture2(sampler2D sampler, vec2 coord){
    return texture2D(sampler,  coord);
}

float snoise(vec3 uv, float res)\t// by trisomie21
{
\tconst vec3 s = vec3(1e0, 1e2, 1e4);
\t
\tuv *= res;
\t
\tvec3 uv0 = floor(mod(uv, res))*s;
\tvec3 uv1 = floor(mod(uv+vec3(1.), res))*s;
\t
\tvec3 f = fract(uv); f = f*f*(3.0-2.0*f);
\t
\tvec4 v = vec4(uv0.x+uv0.y+uv0.z, uv1.x+uv0.y+uv0.z,
\t\t      \t  uv0.x+uv1.y+uv0.z, uv1.x+uv1.y+uv0.z);
\t
\tvec4 r = fract(sin(v*1e-3)*1e5);
\tfloat r0 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
\t
\tr = fract(sin((v + uv1.z - uv0.z)*1e-3)*1e5);
\tfloat r1 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
\t
\treturn mix(r0, r1, f.z)*2.-1.;
}

float freqs[4];

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragCoord += shift;
\tfreqs[0] = texture2( iChannel1, vec2( 0.01, 0.25 ) ).x;
\tfreqs[1] = texture2( iChannel1, vec2( 0.07, 0.25 ) ).x;
\tfreqs[2] = texture2( iChannel1, vec2( 0.15, 0.25 ) ).x;
\tfreqs[3] = texture2( iChannel1, vec2( 0.30, 0.25 ) ).x;

    float brightness\t= freqs[1] * 0.25 + freqs[2] * 0.25;
    vec3 orange\t\t\t= color * 1.1;
\tvec3 orangeRed\t\t= color / 2.0;
\tfloat time\t\t= time * 0.1;
\t

    float radiusB = 0.24 * srcRadius;
    float radiusK = 0.2 * srcRadius;
    float radiusO = 2.0 / srcRadius;
    float radiusC = 2.0 / srcRadius;
    vec2 srcCenter = vec2(fCenter);
    float spXCenter = srcCenter.x * 2.0;
    float spYCenter = srcCenter.x * 2.0;


\tfloat radius\t\t= radiusB + brightness * radiusK;
\tfloat invRadius \t= 1.0/radius;
\t
\tfloat aspect\t= iResolution.x/iResolution.y;
\tvec2 uv\t\t\t= fragCoord.xy / iResolution.xy;
\tvec2 center_offset \t\t\t= uv - srcCenter;
\tcenter_offset.x *= aspect;

\tfloat fade\t\t= pow( length( 1.9 * center_offset ), 0.55 );
\tfloat fVal1\t\t= 1.0 - fade;
\tfloat fVal2\t\t= 1.0 - fade;
\t
\tfloat angle\t\t= atan( center_offset.x, center_offset.y )/6.2832;
\tfloat dist\t\t= length(center_offset);
\tvec3 coord\t\t= vec3( angle, dist, time * 0.1 );
\t
\tfloat newTime1\t= abs( snoise( coord + vec3( 0.0, -time * ( 0.35 + brightness * 0.001 ), time * 0.015 ), 15.0 ) );
\tfloat newTime2\t= abs( snoise( coord + vec3( 0.0, -time * ( 0.15 + brightness * 0.001 ), time * 0.015 ), 45.0 ) );\t
\tfor( int i=1; i<=7; i++ ){
\t\tfloat power = pow( 2.0, float(i + 1) );
\t\tfVal1 += ( 0.5 / power ) * snoise( coord + vec3( 0.0, -time, time * 0.2 ), ( power * ( 10.0 ) * ( newTime1 + 1.0 ) ) );
\t\tfVal2 += ( 0.5 / power ) * snoise( coord + vec3( 0.0, -time, time * 0.2 ), ( power * ( 25.0 ) * ( newTime2 + 1.0 ) ) );
\t}
\t
\tfloat corona\t\t= pow( fVal1 * max( 1.1 - fade, 0.0 ), radiusC ) * 50.0;
\tcorona\t\t\t\t+= pow( fVal2 * max( 1.1 - fade, 0.0 ), radiusC ) * 50.0;
\tcorona\t\t\t\t*= 1.2 - newTime1;
\tvec3 sphereNormal \t= vec3( 0.0, 0.0, 1.0 );
\tvec3 dir \t\t\t= vec3( 0.0 );
\tvec3 center\t\t\t= vec3( 0.5, 0.5, 1.0 );
\tvec3 starSphere\t\t= vec3( 0.0 );
\t
\t
\t
\t// outline
\tvec2 sp = vec2(0);
\tsp.x += -spXCenter + 2.0 * uv.x;
\tsp.y += -spYCenter + 2.0 * uv.y;
\tsp.x *= aspect;
\tsp *= ( radiusO - brightness );
  \tfloat r = dot((sp),(sp));
  \tfloat fbase = (1.0-sqrt(abs(1.0-r)))/(r) + brightness * 0.5;
  \t
  \t
    if( dist < radius ){
\t\tcorona\t\t\t*= pow( dist * invRadius, 24.0 );
  \t\tvec2 newUv;
  \t\tnewUv.x = sp.x*fbase;
  \t\tnewUv.y = sp.y*fbase;
  \t\t
\t\tnewUv += vec2( time, 0.0 );
\t\t
\t\tvec3 texSample \t= texture2( iChannel0, newUv ).rgb;

 \t\t
\t\t
\t\tfloat uOff\t\t= ( texSample.g * brightness * 4.5 + time );
\t\tvec2 starUV\t\t= newUv + vec2( uOff, 0.0 );
\t\tstarSphere\t\t= texture2( iChannel0, starUV ).rgb;
\t}
\t
\tfloat starGlow\t= min( max( 1.0 - dist * ( 1.0 - brightness ), 0.0 ), 1.0 );
\t// outline (like in eclipse)
\tfragColor.rgb += vec3( fbase * ( 0.75 + brightness * 0.3 ) * orange );
\t// rotating texture
\tfragColor.rgb\t+= starSphere;
\t// corona
\tfragColor.rgb   += corona * orange;
\t// emitted light
\t// fragColor.rgb   += starGlow * orangeRed;
\tfragColor.a\t\t= 1.0;
\t// fragColor.rgba = vec4(vNormal * 0.5 + 0.5, 1);
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
  srcRadius: { value: 0.25 },
  fCenter: { value: 0.5 },
  iChannel1: { value: null },
  iResolution: { value: new Vector3(size.width_px, size.height_px, 0) },
  color: { value: new Vector3(0, 0, 0) },
  shift: { value: new Vector2(0, 0) },
};
