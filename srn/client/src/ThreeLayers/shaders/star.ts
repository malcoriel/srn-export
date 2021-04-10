import { Texture, Vector2, Vector3 } from 'three';
// delete viewMatrix, cameraPosition

export const hsvFunctions = `
vec3 rgb2hsv(vec3 c)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
`;

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
float sphereRadius = 0.25;

${hsvFunctions}

float calculate_corona(in vec2 center_offset, in float dist,
    in float brightness, in float time) {
    float fade = pow( length( 1.9 * center_offset ), 0.55 );
    float fVal1 = 1.0 - fade;
    float fVal2 = 1.0 - fade;

    float angle = atan( center_offset.x, center_offset.y )/3.0;
    vec3 coord = vec3( angle, dist, time * 0.1 );

    float newTime1  = abs( snoise( coord + vec3( 0.0, -time * ( 0.35 + brightness * 0.001 ), time * 0.015 ), 15.0 ) );
    float newTime2  = abs( snoise( coord + vec3( 0.0, -time * ( 0.15 + brightness * 0.001 ), time * 0.015 ), 45.0 ) );
    for( int i=1; i<=7; i++ ){
        float power = pow( 2.0, float(i + 1) );
        fVal1 += ( 0.5 / power ) * snoise( coord + vec3( 0.0, -time, time * 0.2 ), ( power * ( 10.0 ) * ( newTime1 + 1.0 ) ) );
        fVal2 += ( 0.5 / power ) * snoise( coord + vec3( 0.0, -time, time * 0.2 ), ( power * ( 25.0 ) * ( newTime2 + 1.0 ) ) );
    }

    float coronaBaseBright = 1.2;
    float corona = pow( fVal1 * max( coronaBaseBright - fade, 0.0 ), 2.0 ) * 50.0;
    corona += pow( fVal2 * max( coronaBaseBright - fade, 0.0 ), 2.0 ) * 50.0;
    corona *= coronaBaseBright - newTime1;
    if(dist < sphereRadius) {
        // cut off the corona inside the sphere
        corona *= 0.0;
    }
    return corona;
}

float calc_brightness() {
    freqs[0] = texture( iChannel1, vec2( 0.01, 0.25 ) ).x;
    freqs[1] = texture( iChannel1, vec2( 0.07, 0.25 ) ).x;
    freqs[2] = texture( iChannel1, vec2( 0.15, 0.25 ) ).x;
    freqs[3] = texture( iChannel1, vec2( 0.30, 0.25 ) ).x;
    return freqs[1] * 0.25 + freqs[2] * 0.25;
}

float grayscale(vec3 color) {
  return dot(color.rgb, vec3(0.299, 0.587, 0.114));
}

void main() {
    float brightness = calc_brightness();
    vec3 orange = color * 1.1;
    vec3 orangeRed = color / 2.0;
    float time = time * 0.001;

    vec2 center_offset = relativeObjectCoord - vec2(0.5);
    float dist = length(center_offset);

    // corona
    float corona = calculate_corona(center_offset, dist, brightness, time);
    FragColor.rgb += corona * orange;


    // atmosphere-like effect (glow right near the edge like in an eclipse)
    vec2 sp = center_offset * (4.0 - brightness);
    float r = dot((sp),(sp));
    float glow_base = (1.0-sqrt(abs(1.0-r)))/(r); // + brightness * 0.5;

    float glow_base2 = glow_base;
    if (dist < sphereRadius) {
      glow_base2 *= r;
    }
    FragColor.rgb += vec3( glow_base2 * 0.7 );

    // rotating texture
    vec3 starSphere = vec3( 0.0 );
    if(dist < sphereRadius) {
        vec2 newUv;
        newUv.x = sp.x * glow_base;
        newUv.y = sp.y * glow_base;
        newUv += vec2( time, 0.0 );
        vec3 texSample = texture( iChannel0, newUv ).rgb;
        float uOff = ( texSample.g * brightness * 4.5 + time );
        vec2 starUV = newUv + vec2( uOff, 0.0 );
        starSphere = texture( iChannel0, starUV ).rgb * color;
    }
    FragColor.rgb += starSphere;

    // transparency outside of everything, limited by radius
    if (dist > sphereRadius) {
      FragColor.a = smoothstep(0.1, 0.7, abs(length(abs(FragColor.rgb))));
    } else {
      FragColor.a = 1.0;
    }
    // FragColor.rgba = vec4(vNormal * 0.5 + 0.5, 1);
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
  color: Vector3UniformValue;
} = {
  iChannel0: { value: null },
  time: { value: 0 },
  iChannel1: { value: null },
  color: { value: new Vector3(0, 0, 0) },
};
