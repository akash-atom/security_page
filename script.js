/**
 * Dot-matrix reveal background (port of 21st.dev "sign-in-flow-1" CanvasRevealEffect)
 * + radial centre fade from the Figma "Centre fade (radial)" layer.
 *
 * Usage: add the custom attribute  data-dot-matrix  to any Webflow section/div.
 * Raw WebGL2, no dependencies. ES5 on purpose (see CLAUDE.md).
 */
(function () {
  'use strict';

  var SELECTOR = '[data-dot-matrix]';

  // Same values as the 21st.dev usage: dotSize 6, total 20, white dots.
  var TOTAL_SIZE = 20;
  var DOT_SIZE = 6;
  var SPEED = 0.5; // hard-coded animation_speed_factor in the original shader
  var OPACITIES = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1];

  // Centre fade from Figma (1503x980 frame): ellipse ~647x380px at (751, 580).
  var FADE =
    'radial-gradient(ellipse 43% 38.8% at 50% 59.2%,' +
    'rgba(0,0,0,0.95) 0%,rgba(0,0,0,0.6) 60%,rgba(0,0,0,0) 100%)';

  var VERT = [
    '#version 300 es',
    'in vec2 position;',
    'uniform vec2 u_resolution;',
    'out vec2 fragCoord;',
    'void main() {',
    '  gl_Position = vec4(position, 0.0, 1.0);',
    '  fragCoord = (position + vec2(1.0)) * 0.5 * u_resolution;',
    '  fragCoord.y = u_resolution.y - fragCoord.y;',
    '}'
  ].join('\n');

  var FRAG = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 fragCoord;',
    'uniform float u_time;',
    'uniform float u_opacities[10];',
    'uniform float u_total_size;',
    'uniform float u_dot_size;',
    'uniform float u_speed;',
    'uniform vec2 u_resolution;',
    'out vec4 fragColor;',
    'float PHI = 1.61803398874989484820459;',
    'float random(vec2 xy) {',
    '  return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);',
    '}',
    'void main() {',
    '  vec2 st = fragCoord.xy;',
    '  st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));',
    '  st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));',
    '  float opacity = step(0.0, st.x);',
    '  opacity *= step(0.0, st.y);',
    '  vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));',
    '  float frequency = 5.0;',
    '  float show_offset = random(st2);',
    '  float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));',
    '  opacity *= u_opacities[int(rand * 10.0)];',
    '  opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));',
    '  opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));',
    '  vec3 color = vec3(1.0);',
    '  vec2 center_grid = u_resolution / 2.0 / u_total_size;',
    '  float dist_from_center = distance(center_grid, st2);',
    '  float timing_offset = dist_from_center * 0.01 + (random(st2) * 0.15);',
    '  opacity *= step(timing_offset, u_time * u_speed);',
    '  opacity *= clamp((1.0 - step(timing_offset + 0.1, u_time * u_speed)) * 1.25, 1.0, 1.25);',
    '  fragColor = vec4(color, opacity);',
    '  fragColor.rgb *= fragColor.a;',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[dot-matrix] shader error:', gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  function createProgram(gl) {
    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[dot-matrix] link error:', gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  function init(container) {
    if (container.getAttribute('data-dot-matrix-ready')) return;

    var canvas = document.createElement('canvas');
    var gl = canvas.getContext('webgl2', { alpha: true, antialias: false });
    if (!gl) return; // no WebGL2: leave the section as-is

    var program = createProgram(gl);
    if (!program) return;

    container.setAttribute('data-dot-matrix-ready', 'true');

    // Layer stack: wrapper (black bg) > canvas + radial fade.
    // z-index:-1 inside an isolated container keeps it behind the section content.
    if (window.getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    container.style.isolation = 'isolate';

    var wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText =
      'position:absolute;top:0;right:0;bottom:0;left:0;z-index:-1;' +
      'background:#000;overflow:hidden;pointer-events:none;';
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
    var fade = document.createElement('div');
    fade.style.cssText =
      'position:absolute;top:0;right:0;bottom:0;left:0;background:' + FADE + ';';
    wrap.appendChild(canvas);
    wrap.appendChild(fade);
    container.insertBefore(wrap, container.firstChild);

    // Full-screen quad
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.useProgram(program);
    var posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    var uTime = gl.getUniformLocation(program, 'u_time');
    var uRes = gl.getUniformLocation(program, 'u_resolution');
    gl.uniform1fv(gl.getUniformLocation(program, 'u_opacities'), new Float32Array(OPACITIES));
    gl.uniform1f(gl.getUniformLocation(program, 'u_total_size'), TOTAL_SIZE);
    gl.uniform1f(gl.getUniformLocation(program, 'u_dot_size'), DOT_SIZE);
    gl.uniform1f(gl.getUniformLocation(program, 'u_speed'), SPEED);

    // Additive-ish blend, same as the original (SrcAlpha, One)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0, 0, 0, 0);

    var reduceMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var visible = false;
    var started = false;
    var startTime = 0;
    var rafId = 0;

    function resize() {
      var w = container.clientWidth;
      var h = container.clientHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      // The original shader works in a 2x coordinate space regardless of DPR.
      gl.uniform2f(uRes, w * 2, h * 2);
    }

    function draw(t) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, t);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function frame(now) {
      if (!visible) {
        rafId = 0;
        return;
      }
      draw((now - startTime) / 1000);
      rafId = window.requestAnimationFrame(frame);
    }

    function setVisible(v) {
      visible = v;
      if (!v) return;
      if (reduceMotion) {
        draw(100); // fully revealed, static
        return;
      }
      if (!started) {
        started = true;
        startTime = window.performance.now(); // intro plays when first seen
      }
      if (!rafId) rafId = window.requestAnimationFrame(frame);
    }

    resize();
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () {
        resize();
        if (reduceMotion && visible) draw(100);
      }).observe(container);
    } else {
      window.addEventListener('resize', function () {
        resize();
        if (reduceMotion && visible) draw(100);
      });
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        setVisible(entries[0].isIntersecting);
      }).observe(container);
    } else {
      setVisible(true);
    }
  }

  function initAll() {
    var nodes = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < nodes.length; i++) init(nodes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
