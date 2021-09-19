"use strict";

// Returns a random integer from 0 to range - 1.
function randomInt(range) {
  return Math.floor(Math.random() * range);
}

function main() {
  var textureData;
  var textureInfo = {};
  var idx_overwrite = 0;
  var actors = [];
  
  const initialActors = 10;
  const maxActors = 50000;
  const lookDirection = Math.PI / 4;
  const lookMomentum = 0.1;
  const lookDistance = 2;
  const maxRgbIncrement = 1;
  const blurRange = 2;
  const blurInterpolate = 0.01;
  const initialSpeed = 0.8;
  const directionWobble = Math.PI / 2;
  const spawnLikelihoodDivisor = 1;
    
    // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  var canvas = document.querySelector("#canvas");
  var gl = canvas.getContext("webgl");
  if (!gl) {
    return;
  }

  // setup GLSL program
  var program = webglUtils.createProgramFromScripts(gl, ["drawImage-vertex-shader", "drawImage-fragment-shader"]);

  // look up where the vertex data needs to go.
  var positionLocation = gl.getAttribLocation(program, "a_position");
  var texcoordLocation = gl.getAttribLocation(program, "a_texcoord");

  // lookup uniforms
  var matrixLocation = gl.getUniformLocation(program, "u_matrix");
  var textureLocation = gl.getUniformLocation(program, "u_texture");

  // Create a buffer.
  var positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Put a unit quad in the buffer
  var positions = [
    0, 0,
    0, 1,
    1, 0,
    1, 0,
    0, 1,
    1, 1,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  // Create a buffer for texture coords
  var texcoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);

  // Put texcoords in the buffer
  var texcoords = [
    0, 0,
    0, 1,
    1, 0,
    1, 0,
    0, 1,
    1, 1,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.STATIC_DRAW);

  // creates a texture info { width: w, height: h, texture: tex }
  // The texture will start with 1x1 pixels and be updated
  // when the image has loaded
  function loadImageAndCreateTextureInfo(url) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Fill the texture with a 1x1 blue pixel.

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                  new Uint8Array([0, 0, 255, 255]));

    // let's assume all images are not a power of 2
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    textureInfo = {
      width: 1,   // we don't know the size until it loads
      height: 1,
      texture: tex,
    };
    var img = new Image();
    img.addEventListener('load', function() {
      textureInfo.width = img.width;
      textureInfo.height = img.height;

      gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

      // Read the image data into an array
      var framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textureInfo.texture, 0);

      textureData = new Uint8Array(this.width * this.height * 4);
      gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, textureData);

      gl.deleteFramebuffer(framebuffer);

      initializeActors();
    });
    img.src = url;

    return textureInfo;
  }

  var textureInfo = loadImageAndCreateTextureInfo('first2.jpg');

  function draw() {
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clear(gl.COLOR_BUFFER_BIT);

    if (textureData) {
      //textureData[randomInt(textureInfo.width * textureInfo.height) * 4] = randomInt(256);
      gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureInfo.width, textureInfo.height, gl.RGBA, gl.UNSIGNED_BYTE, textureData);
    }

    drawImage(textureInfo)
  }

  function render(time) {
    processActors();
    draw();

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);

  // Unlike images, textures do not have a width and height associated
  // with them so we'll pass in the width and height of the texture
  function drawImage(texInfo) {
    gl.bindTexture(gl.TEXTURE_2D, texInfo.texture);

    // Tell WebGL to use our shader program pair
    gl.useProgram(program);

    // Setup the attributes to pull data from our buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.enableVertexAttribArray(texcoordLocation);
    gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 0, 0);

    // this matrix will convert from pixels to clip space
    var matrix = m4.orthographic(0, gl.canvas.width, gl.canvas.height, 0, -1, 1);

    // this matrix will translate our quad to dstX, dstY
    matrix = m4.translate(matrix, 0, 0, 0);

    // this matrix will scale our 1 unit quad
    // from 1 unit to texWidth, texHeight units
    matrix = m4.scale(matrix, texInfo.width, texInfo.height, 1);

    // Set the matrix.
    gl.uniformMatrix4fv(matrixLocation, false, matrix);

    // Tell the shader to get the texture from texture unit 0
    gl.uniform1i(textureLocation, 0);

    // draw the quad (2 triangles, 6 vertices)
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function initializeActors() {
    for (var i = 0; i < initialActors; i++) {
      actors.push(createNewRandomActor());
    }
  }

  function createNewRandomActor() {
    return {
      'position': [randomInt(textureInfo.width), randomInt(textureInfo.height)],
      'direction': Math.random() * Math.PI * 2,
      'speed': initialSpeed,
      'age': randomInt(10)
    };
  }

  function spawnNewActor(actor) {
    return {
      'position': [actor['position'][0], actor['position'][1]],
      'direction': actor['direction'] + Math.PI + Math.random() * directionWobble - (directionWobble / 2.0),
      'speed': actor['speed'],
      'age': randomInt(10)
    }
  }

  function processActors() {
    var new_actors = [];
    var idx = 0;
  
    actors.forEach(actor => {
      var new_actor = {
        'position': [],
        'speed': actor['speed'],
        'direction': actor['direction']
      }
      var {lv, mv, rv} = getDirectionalValues(actor);
      var dr;
      if (lv > mv && lv > rv) {
        dr = -1;
      } else if (rv > mv && rv > lv) {
        dr = 1
      } else {
        dr = 0;
      }
      new_actor['direction'] += dr * lookDirection * lookMomentum;

      incrementDepositValue(actor['position'], Math.max(lv, mv, rv));
      blurDepositValue(actor['position']);

      new_actor['position'][0] = actor['position'][0] + new_actor['speed'] * Math.cos(new_actor['direction']);
      new_actor['position'][1] = actor['position'][1] + new_actor['speed'] * Math.sin(new_actor['direction']);

      if (new_actor['position'][0] > 0 &&
          new_actor['position'][0] < textureInfo.width &&
          new_actor['position'][1] > 1 &&
          new_actor['position'][1] < textureInfo.height &&
          getDepositValue(actor['position']) < 255 * 3) {
        new_actors.push(new_actor);
      } /*else {
        if (actors.length < maxActors) {
          new_actors.push(createNewRandomActor());
        }
      }*/

      // at random, spawn a new actor from this one
      if ((Math.random() * maxActors) / spawnLikelihoodDivisor > actors.length) {
        new_actors.push(spawnNewActor(actor));
      }
    })
  
    actors = new_actors;
  }

  function getMoveCoords(actor, distance, direction) {
    var look_x = actor['position'][0] + distance * Math.cos(actor['direction'] + direction);
    var look_y = actor['position'][1] + distance * Math.sin(actor['direction'] + direction);
    return [look_x, look_y];
  }

  function textureIdxFromCoords(coords) {
    return (Math.floor(coords[0]) + Math.floor(coords[1]) * textureInfo.width) * 4;
  }
  
  function getDepositValue(coords) {
    var texture_idx = textureIdxFromCoords(coords);
    return textureData[texture_idx] + textureData[texture_idx + 1] + textureData[texture_idx + 2];
  }
  
  function getDirectionalValues(actor) {
    var lcoords = getMoveCoords(actor, actor['speed'] * lookDistance, -lookDirection);
    var lv = getDepositValue(lcoords);
  
    var rcoords = getMoveCoords(actor, actor['speed'] * lookDistance, lookDirection);
    var rv = getDepositValue(rcoords);
  
    var mcoords = getMoveCoords(actor, actor['speed'] * lookDistance, 0);
    var mv = getDepositValue(mcoords);
  
    return {'lv': lv, 'mv': mv, 'rv': rv};
  }

  function incRgbValue(idx) {
    return 1 + randomInt(maxRgbIncrement - 1);
  }
  
  function incrementDepositValue(coords, amount) {
    var texture_idx = textureIdxFromCoords(coords);
    for (var i = 0; i < 3; i++) {
      textureData[texture_idx + i] = Math.min(255, textureData[texture_idx + i] + incRgbValue(i));
    }
  }  

  function blurDepositValue(coords) {
    var average = [0,0,0];
    var values = [];

    // first get the average value
    for (var x = Math.max(coords[0] - blurRange, 0); x <= Math.min(coords[0] + blurRange, textureInfo.width); x++) {
      for (var y = Math.max(coords[1] - blurRange, 0); y <= Math.min(coords[1] + blurRange, textureInfo.height); y++) {
        var idx = textureIdxFromCoords([x,y]);
        var rgbs = [];
        for (var rgb = 0; rgb < 3; rgb++) {
          rgbs.push(textureData[idx + rgb])
        }
        values.push(rgbs);
      }
    }

    var totals = [0, 0, 0];
    values.forEach(rgbs => {
      for (var i = 0; i < 3; i++) {
        totals[i] += rgbs[i];
      }
    });

    for (var i = 0; i < 3; i++) {
      average[i] = totals[i] / values.length;
    }

    // then interpolate to the average
    for (var x = Math.max(coords[0] - blurRange, 0); x <= Math.min(coords[0] + blurRange, textureInfo.width); x++) {
      for (var y = Math.max(coords[1] - blurRange, 0); y <= Math.min(coords[1] + blurRange, textureInfo.height); y++) {
        var idx = textureIdxFromCoords([x,y]);
        for (var rgb = 0; rgb < 3; rgb++) {
          var delta = average[rgb] - textureData[idx + rgb];

          textureData[idx + rgb] = Math.round(textureData[idx + rgb] + delta * blurInterpolate);
        }
      }
    }
  }
}
window.onload = main;
