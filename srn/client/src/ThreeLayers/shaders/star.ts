import { Texture, Vector2, Vector3 } from 'three';
// delete viewMatrix, cameraPosition

export const vertexShader = `#version 300 es
precision highp float;
precision highp int;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;

in vec3 position;
in vec3 normal;
in vec2 uv;
in vec2 uv2;
out vec2 relativeObjectCoord;

void main() {
    relativeObjectCoord = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;
export const fragmentShader = `#version 300 es
precision highp float;
precision highp int;
uniform float time;
uniform vec3 color;

in vec2 relativeObjectCoord;
out vec4 FragColor;

uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform float srcRadius;
uniform vec2 shift;

float snoise(vec3 uv, float res)    // by trisomie21
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

void mainImage( out vec4 fragColor)
{
    freqs[0] = texture( iChannel1, vec2( 0.01, 0.25 ) ).x;
    freqs[1] = texture( iChannel1, vec2( 0.07, 0.25 ) ).x;
    freqs[2] = texture( iChannel1, vec2( 0.15, 0.25 ) ).x;
    freqs[3] = texture( iChannel1, vec2( 0.30, 0.25 ) ).x;

    float brightness    = freqs[1] * 0.25 + freqs[2] * 0.25;
    vec3 orange            = color * 1.1;
    vec3 orangeRed        = color / 2.0;
    float time        = time * 0.1;

    float usedSrcRadius = srcRadius * 0.5;
    float radiusB = 0.24 * usedSrcRadius;
    float radiusK = 0.5 * usedSrcRadius;
    float radiusC = 2.0 / usedSrcRadius;
    vec2 srcCenter = vec2(0.5);


    float radius        = radiusB;

    vec2 uv            = relativeObjectCoord;
    vec2 center_offset             = uv - srcCenter;

    float fade        = pow( length( 1.9 * center_offset ), 0.55 );
    float fVal1        = 1.0 - fade;
    float fVal2        = 1.0 - fade;

    float angle        = atan( center_offset.x, center_offset.y )/3.0;
    float dist        = length(center_offset);
    vec3 coord        = vec3( angle, dist, time * 0.1 );

    float newTime1    = abs( snoise( coord + vec3( 0.0, -time * ( 0.35 + brightness * 0.001 ), time * 0.015 ), 15.0 ) );
    float newTime2    = abs( snoise( coord + vec3( 0.0, -time * ( 0.15 + brightness * 0.001 ), time * 0.015 ), 45.0 ) );
    for( int i=1; i<=7; i++ ){
        float power = pow( 2.0, float(i + 1) );
        fVal1 += ( 0.5 / power ) * snoise( coord + vec3( 0.0, -time, time * 0.2 ), ( power * ( 10.0 ) * ( newTime1 + 1.0 ) ) );
        fVal2 += ( 0.5 / power ) * snoise( coord + vec3( 0.0, -time, time * 0.2 ), ( power * ( 25.0 ) * ( newTime2 + 1.0 ) ) );
    }

    float coronaBaseBright = 1.15;

    float corona        = pow( fVal1 * max( coronaBaseBright - fade, 0.0 ), radiusC ) * 50.0;
    corona                += pow( fVal2 * max( coronaBaseBright - fade, 0.0 ), radiusC ) * 50.0;
    corona                *= coronaBaseBright - newTime1;
    vec3 sphereNormal     = vec3( 0.0, 0.0, 1.0 );
    vec3 dir             = vec3( 0.0 );
    vec3 center            = vec3( 0.5, 0.5, 1.0 );
    vec3 starSphere        = vec3( 0.0 );



    // outline
    vec2 sp = vec2(uv.x - srcCenter.x, uv.y - srcCenter.y);
    sp *= 4.0 / usedSrcRadius - brightness;
    float r = dot((sp),(sp));
    float fbase = (1.0-sqrt(abs(1.0-r)))/(r); // + brightness * 0.5;


    if( dist < radius ){
        corona            *= 0.0;
        vec2 newUv;
        newUv.x = sp.x*fbase;
        newUv.y = sp.y*fbase;

        newUv += vec2( time, 0.0 );

        vec3 texSample     = texture( iChannel0, newUv ).rgb;
        float uOff        = ( texSample.g * brightness * 4.5 + time );
        vec2 starUV        = newUv + vec2( uOff, 0.0 );
        starSphere        = texture( iChannel0, starUV ).rgb;
    }

    float starGlow    = min( max( 1.0 - dist * ( 1.0 - brightness ), 0.0 ), 1.0 );
    // outline (like in eclipse)
    fragColor.rgb += vec3( fbase * ( 0.75 + brightness * 0.3 ) * orange );
    // fragColor.rgb = vec3(uv.x);
    // rotating texture
    fragColor.rgb    += starSphere;
    // corona
    fragColor.rgb   += corona * orange;
    // emitted light
    // fragColor.rgb   += starGlow * orangeRed;
    float d = abs(length(abs(fragColor.rgb)));
    fragColor.a = smoothstep(0.1, 0.7, d);
    // fragColor.rgba = vec4(vNormal * 0.5 + 0.5, 1);
}

void main() {
  mainImage(FragColor);
}



`;

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

export const uniforms: {
  iChannel0: TextureUniformValue;
  time: FloatUniformValue;
  iChannel1: TextureUniformValue;
  srcRadius: FloatUniformValue;
  color: Vector3UniformValue;
  shift: Vector2UniformValue;
} = {
  iChannel0: { value: null },
  time: { value: 0 },
  srcRadius: { value: 0.25 },
  iChannel1: { value: null },
  color: { value: new Vector3(0, 0, 0) },
  shift: { value: new Vector2(0, 0) },
};
