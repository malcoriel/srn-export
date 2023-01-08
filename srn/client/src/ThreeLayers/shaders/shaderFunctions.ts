export const perlinNoise = `
float rand_perlin(vec2 c){
    return fract(sin(dot(c.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

float pNoiseInt(vec2 p, float freq ){
  float PI = 3.14159265358979323846;
  float unit = 1.0 / freq;
  vec2 ij = floor(p/unit);
  vec2 xy = mod(p,unit)/unit;
  //xy = 3.*xy*xy-2.*xy*xy*xy;
  xy = .5*(1.-cos(PI*xy));
  float a = rand_perlin((ij+vec2(0.,0.)));
  float b = rand_perlin((ij+vec2(1.,0.)));
  float c = rand_perlin((ij+vec2(0.,1.)));
  float d = rand_perlin((ij+vec2(1.,1.)));
  float x1 = mix(a, b, xy.x);
  float x2 = mix(c, d, xy.x);
  return mix(x1, x2, xy.y);
}

float pNoise(vec2 p, int res, float freq) {
    float persistance = .5;
    float n = 0.;
    float normK = 0.;
    float f = freq;
    float amp = 1.;
    int iCount = 0;
    for (int i = 0; i<50; i++){
        n+=amp*pNoiseInt(p, f);
        f*=2.;
        normK+=amp;
        amp*=persistance;
        if (iCount == res) break;
        iCount++;
    }
    float nf = n/normK;
    return nf*nf*nf*nf;
}
`;

export const simplexNoise2 = `
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float simplex_noise_2(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}`;
export const simplexNoise3 = `// Simplex 3D Noise
// by Ian McEwan, Ashima Arts
//
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float simplex_noise_3(vec3 v){
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //  x0 = x0 - 0. + 0.0 * C
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;

// Permutations
  i = mod(i, 289.0 );
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients
// ( N*N points uniformly over a square, mapped onto an octahedron.)
  float n_ = 1.0/7.0; // N=7
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}`;
export const fractalNoise = `float fractal_noise(vec3 position, int octaves, float frequency, float persistence) {
    float total = 0.0; // Total value so far
    float maxAmplitude = 0.0; // Accumulates highest theoretical amplitude
    float amplitude = 1.0;
    for (int i = 0; i < octaves; i++) {

        // Get the noise sample
        total += simplex_noise_3(position * frequency) * amplitude;

        // Make the wavelength twice as small
        frequency *= 2.0;

        // Add to our maximum possible amplitude
        maxAmplitude += amplitude;

        // Reduce amplitude according to persistence for the next octave
        amplitude *= persistence;
    }

    // Scale the result by the maximum amplitude
    return total / maxAmplitude;
}`;

export const worleyNoise2d = `
// Permutation polynomial: (34x^2 + x) mod 289
vec3 permute_worley(vec3 x) {
  return mod((34.0 * x + 1.0) * x, 289.0);
}

vec3 dist(vec3 x, vec3 y,  bool manhattanDistance) {
  return manhattanDistance ?  abs(x) + abs(y) :  (x * x + y * y);
}

vec2 worley_noise_2d(vec2 P, float jitter, bool manhattanDistance) {
  float K= 0.142857142857; // 1/7
  float Ko= 0.428571428571 ;// 3/7
  vec2 Pi = mod(floor(P), 289.0);
  vec2 Pf = fract(P);
  vec3 oi = vec3(-1.0, 0.0, 1.0);
  vec3 of = vec3(-0.5, 0.5, 1.5);
  vec3 px = permute_worley(Pi.x + oi);
  vec3 p = permute_worley(px.x + Pi.y + oi); // p11, p12, p13
  vec3 ox = fract(p*K) - Ko;
  vec3 oy = mod(floor(p*K),7.0)*K - Ko;
  vec3 dx = Pf.x + 0.5 + jitter*ox;
  vec3 dy = Pf.y - of + jitter*oy;
  vec3 d1 = dist(dx,dy, manhattanDistance); // d11, d12 and d13, squared
  p = permute_worley(px.y + Pi.y + oi); // p21, p22, p23
  ox = fract(p*K) - Ko;
  oy = mod(floor(p*K),7.0)*K - Ko;
  dx = Pf.x - 0.5 + jitter*ox;
  dy = Pf.y - of + jitter*oy;
  vec3 d2 = dist(dx,dy, manhattanDistance); // d21, d22 and d23, squared
  p = permute_worley(px.z + Pi.y + oi); // p31, p32, p33
  ox = fract(p*K) - Ko;
  oy = mod(floor(p*K),7.0)*K - Ko;
  dx = Pf.x - 1.5 + jitter*ox;
  dy = Pf.y - of + jitter*oy;
  vec3 d3 = dist(dx,dy, manhattanDistance); // d31, d32 and d33, squared
  // Sort out the two smallest distances (F1, F2)
  vec3 d1a = min(d1, d2);
  d2 = max(d1, d2); // Swap to keep candidates for F2
  d2 = min(d2, d3); // neither F1 nor F2 are now in d3
  d1 = min(d1a, d2); // F1 is now in d1
  d2 = max(d1a, d2); // Swap to keep candidates for F2
  d1.xy = (d1.x < d1.y) ? d1.xy : d1.yx; // Swap if smaller
  d1.xz = (d1.x < d1.z) ? d1.xz : d1.zx; // F1 is in d1.x
  d1.yz = min(d1.yz, d2.yz); // F2 is now not in d2.yz
  d1.y = min(d1.y, d1.z); // nor in  d1.z
  d1.y = min(d1.y, d2.x); // F2 is in d1.y, we're done.
  return sqrt(d1.xy);
  }
`;

export const worleyNoise3d = `
// Permutation polynomial: (34x^2 + x) mod 289
vec3 permute_worley3(vec3 x) {
  return mod((34.0 * x + 1.0) * x, 289.0);
}

vec3 dist(vec3 x, vec3 y, vec3 z,  bool manhattanDistance) {
  return manhattanDistance ?  abs(x) + abs(y) + abs(z) :  (x * x + y * y + z * z);
}

vec2 worley_noise_3d(vec3 P, float jitter, bool manhattanDistance) {
float K = 0.142857142857; // 1/7
float Ko = 0.428571428571; // 1/2-K/2
float  K2 = 0.020408163265306; // 1/(7*7)
float Kz = 0.166666666667; // 1/6
float Kzo = 0.416666666667; // 1/2-1/6*2

vec3 Pi = mod(floor(P), 289.0);
 vec3 Pf = fract(P) - 0.5;

vec3 Pfx = Pf.x + vec3(1.0, 0.0, -1.0);
vec3 Pfy = Pf.y + vec3(1.0, 0.0, -1.0);
vec3 Pfz = Pf.z + vec3(1.0, 0.0, -1.0);

vec3 p = permute_worley3(Pi.x + vec3(-1.0, 0.0, 1.0));
vec3 p1 = permute_worley3(p + Pi.y - 1.0);
vec3 p2 = permute_worley3(p + Pi.y);
vec3 p3 = permute_worley3(p + Pi.y + 1.0);

vec3 p11 = permute_worley3(p1 + Pi.z - 1.0);
vec3 p12 = permute_worley3(p1 + Pi.z);
vec3 p13 = permute_worley3(p1 + Pi.z + 1.0);

vec3 p21 = permute_worley3(p2 + Pi.z - 1.0);
vec3 p22 = permute_worley3(p2 + Pi.z);
vec3 p23 = permute_worley3(p2 + Pi.z + 1.0);

vec3 p31 = permute_worley3(p3 + Pi.z - 1.0);
vec3 p32 = permute_worley3(p3 + Pi.z);
vec3 p33 = permute_worley3(p3 + Pi.z + 1.0);

vec3 ox11 = fract(p11*K) - Ko;
vec3 oy11 = mod(floor(p11*K), 7.0)*K - Ko;
vec3 oz11 = floor(p11*K2)*Kz - Kzo; // p11 < 289 guaranteed

vec3 ox12 = fract(p12*K) - Ko;
vec3 oy12 = mod(floor(p12*K), 7.0)*K - Ko;
vec3 oz12 = floor(p12*K2)*Kz - Kzo;

vec3 ox13 = fract(p13*K) - Ko;
vec3 oy13 = mod(floor(p13*K), 7.0)*K - Ko;
vec3 oz13 = floor(p13*K2)*Kz - Kzo;

vec3 ox21 = fract(p21*K) - Ko;
vec3 oy21 = mod(floor(p21*K), 7.0)*K - Ko;
vec3 oz21 = floor(p21*K2)*Kz - Kzo;

vec3 ox22 = fract(p22*K) - Ko;
vec3 oy22 = mod(floor(p22*K), 7.0)*K - Ko;
vec3 oz22 = floor(p22*K2)*Kz - Kzo;

vec3 ox23 = fract(p23*K) - Ko;
vec3 oy23 = mod(floor(p23*K), 7.0)*K - Ko;
vec3 oz23 = floor(p23*K2)*Kz - Kzo;

vec3 ox31 = fract(p31*K) - Ko;
vec3 oy31 = mod(floor(p31*K), 7.0)*K - Ko;
vec3 oz31 = floor(p31*K2)*Kz - Kzo;

vec3 ox32 = fract(p32*K) - Ko;
vec3 oy32 = mod(floor(p32*K), 7.0)*K - Ko;
vec3 oz32 = floor(p32*K2)*Kz - Kzo;

vec3 ox33 = fract(p33*K) - Ko;
vec3 oy33 = mod(floor(p33*K), 7.0)*K - Ko;
vec3 oz33 = floor(p33*K2)*Kz - Kzo;

vec3 dx11 = Pfx + jitter*ox11;
vec3 dy11 = Pfy.x + jitter*oy11;
vec3 dz11 = Pfz.x + jitter*oz11;

vec3 dx12 = Pfx + jitter*ox12;
vec3 dy12 = Pfy.x + jitter*oy12;
vec3 dz12 = Pfz.y + jitter*oz12;

vec3 dx13 = Pfx + jitter*ox13;
vec3 dy13 = Pfy.x + jitter*oy13;
vec3 dz13 = Pfz.z + jitter*oz13;

vec3 dx21 = Pfx + jitter*ox21;
vec3 dy21 = Pfy.y + jitter*oy21;
vec3 dz21 = Pfz.x + jitter*oz21;

vec3 dx22 = Pfx + jitter*ox22;
vec3 dy22 = Pfy.y + jitter*oy22;
vec3 dz22 = Pfz.y + jitter*oz22;

vec3 dx23 = Pfx + jitter*ox23;
vec3 dy23 = Pfy.y + jitter*oy23;
vec3 dz23 = Pfz.z + jitter*oz23;

vec3 dx31 = Pfx + jitter*ox31;
vec3 dy31 = Pfy.z + jitter*oy31;
vec3 dz31 = Pfz.x + jitter*oz31;

vec3 dx32 = Pfx + jitter*ox32;
vec3 dy32 = Pfy.z + jitter*oy32;
vec3 dz32 = Pfz.y + jitter*oz32;

vec3 dx33 = Pfx + jitter*ox33;
vec3 dy33 = Pfy.z + jitter*oy33;
vec3 dz33 = Pfz.z + jitter*oz33;

vec3 d11 = dist(dx11, dy11, dz11, manhattanDistance);
vec3 d12 =dist(dx12, dy12, dz12, manhattanDistance);
vec3 d13 = dist(dx13, dy13, dz13, manhattanDistance);
vec3 d21 = dist(dx21, dy21, dz21, manhattanDistance);
vec3 d22 = dist(dx22, dy22, dz22, manhattanDistance);
vec3 d23 = dist(dx23, dy23, dz23, manhattanDistance);
vec3 d31 = dist(dx31, dy31, dz31, manhattanDistance);
vec3 d32 = dist(dx32, dy32, dz32, manhattanDistance);
vec3 d33 = dist(dx33, dy33, dz33, manhattanDistance);

vec3 d1a = min(d11, d12);
d12 = max(d11, d12);
d11 = min(d1a, d13); // Smallest now not in d12 or d13
d13 = max(d1a, d13);
d12 = min(d12, d13); // 2nd smallest now not in d13
vec3 d2a = min(d21, d22);
d22 = max(d21, d22);
d21 = min(d2a, d23); // Smallest now not in d22 or d23
d23 = max(d2a, d23);
d22 = min(d22, d23); // 2nd smallest now not in d23
vec3 d3a = min(d31, d32);
d32 = max(d31, d32);
d31 = min(d3a, d33); // Smallest now not in d32 or d33
d33 = max(d3a, d33);
d32 = min(d32, d33); // 2nd smallest now not in d33
vec3 da = min(d11, d21);
d21 = max(d11, d21);
d11 = min(da, d31); // Smallest now in d11
d31 = max(da, d31); // 2nd smallest now not in d31
d11.xy = (d11.x < d11.y) ? d11.xy : d11.yx;
d11.xz = (d11.x < d11.z) ? d11.xz : d11.zx; // d11.x now smallest
d12 = min(d12, d21); // 2nd smallest now not in d21
d12 = min(d12, d22); // nor in d22
d12 = min(d12, d31); // nor in d31
d12 = min(d12, d32); // nor in d32
d11.yz = min(d11.yz,d12.xy); // nor in d12.yz
d11.y = min(d11.y,d12.z); // Only two more to go
d11.y = min(d11.y,d11.z); // Done! (Phew!)
return sqrt(d11.xy); // F1, F2

}
`;
