"use strict";

var gl;
var colorUniformLocation;
var pixels = [];

const numpixels = 50000;

var actors = [];
var deposits = [];

function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  var canvas = document.querySelector("#canvas");
  gl = canvas.getContext("experimental-webgl");

  if (!gl) {
    alert("There's no WebGL context available.");
    return;
  }

  // setup GLSL program
  var program = webglUtils.createProgramFromScripts(gl, ["vertex-shader-2d", "fragment-shader-2d"]);

  // look up where the vertex data needs to go.
  var positionAttributeLocation = gl.getAttribLocation(program, "a_position");

  // look up uniform locations
  var resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
  colorUniformLocation = gl.getUniformLocation(program, "u_color");

  // Create a buffer to put three 2d clip space points in
  var positionBuffer = gl.createBuffer();

  for (var i = 0; i < numpixels / 2; i++) {
    pixels[i * 2] = i;
    pixels[i * 2 + 1] = i;
  }

  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  webglUtils.resizeCanvasToDisplaySize(gl.canvas);

  // Tell WebGL how to convert from clip space to pixels
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  // Clear the canvas
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Tell it to use our program (pair of shaders)
  gl.useProgram(program);

  // Turn on the attribute
  gl.enableVertexAttribArray(positionAttributeLocation);

  // Bind the position buffer.
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  pixels = new Float32Array(pixels);

  // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  var size = 2;          // 2 components per iteration
  var type = gl.FLOAT;   // the data is 32bit floats
  var normalize = false; // don't normalize the data
  var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0;        // start at the beginning of the buffer
  gl.vertexAttribPointer(
      positionAttributeLocation, size, type, normalize, stride, offset);

  // set the resolution
  gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);

  initializeActors();
  initializeDeposits();

  animate();
}

function initializeActors() {

}

function initializeDeposits() {
  
}

function animate() {
  requestAnimationFrame(animate);
  drawScene();
}

function drawScene() {
  for (var ii = 0; ii < numpixels / 2; ++ii) {
    pixels[ii] = randomInt(gl.canvas.width);
    pixels[ii + 1] = randomInt(gl.canvas.height);
  }

  gl.bufferData(gl.ARRAY_BUFFER, pixels, gl.DYNAMIC_DRAW);
    // Set a random color.
  gl.uniform4f(colorUniformLocation, Math.random(), Math.random(), Math.random(), 1);

  // Draw the rectangle.
  var primitiveType = gl.POINTS;
  var offset = 0;
  var count = numpixels / 2;
  gl.drawArrays(primitiveType, offset, count);
}

// Returns a random integer from 0 to range - 1.
function randomInt(range) {
  return Math.floor(Math.random() * range);
}

// Fill the buffer with the values that define a rectangle.
function setLine(gl, x, y, dx, dy) {
  var x1 = x;
  var x2 = x + dx;
  var y1 = y;
  var y2 = y + dy;
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
     x1, y1,
     x2, y2,
  ]), gl.DYNAMIC_DRAW);
}

window.onload = main;
