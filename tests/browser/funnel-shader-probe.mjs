// Probe the actual current production point program without replacing its equations.
export async function nativeFunnelTrajectories(page){
  const result=await page.evaluate(()=>{
    const gl=document.querySelector('#replay-appearance-canvas').getContext('webgl2'),originalProgram=gl.getParameter(gl.CURRENT_PROGRAM);
    const originalVAO=gl.getParameter(gl.VERTEX_ARRAY_BINDING),originalBuffer=gl.getParameter(gl.ARRAY_BUFFER_BINDING),originalTF=gl.getParameter(gl.TRANSFORM_FEEDBACK_BINDING),originalTFBuffer=gl.getParameter(gl.TRANSFORM_FEEDBACK_BUFFER_BINDING),originalDiscard=gl.isEnabled(gl.RASTERIZER_DISCARD);
    const source=gl.getShaderSource(gl.getAttachedShaders(originalProgram).find(s=>gl.getShaderParameter(s,gl.SHADER_TYPE)===gl.VERTEX_SHADER));
    let program=null,vao=null,input=null,output=null,tf=null;const shaders=[];
    try{
      program=gl.createProgram();
      for(const [kind,text]of [[gl.VERTEX_SHADER,source],[gl.FRAGMENT_SHADER,'#version 300 es\nprecision mediump float;out vec4 result;void main(){result=vec4(1.0);}']]){
        const shader=gl.createShader(kind);shaders.push(shader);gl.shaderSource(shader,text);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);
      }
      gl.transformFeedbackVaryings(program,['kinematicProbe'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      vao=gl.createVertexArray();gl.bindVertexArray(vao);input=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,input);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([.25,.5,.4,0,.25,.5,.4,1]),gl.STATIC_DRAW);
      const attribute=gl.getAttribLocation(program,'seed');gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,4,gl.FLOAT,false,0,0);
      tf=gl.createTransformFeedback();gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,tf);output=gl.createBuffer();gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,32,gl.DYNAMIC_READ);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);
      gl.useProgram(program);const uniform=name=>gl.getUniformLocation(program,name);
      gl.uniformMatrix4fv(uniform('camera'),false,new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));
      gl.uniform3f(uniform('shape'),.13,.83,.12);gl.uniform1f(uniform('extent'),1);gl.uniform1f(uniform('viewportHeight'),550);gl.uniform1f(uniform('maxPoint'),64);
      gl.uniform1i(uniform('dust'),1);gl.uniform1i(uniform('kinematic'),1);gl.uniform1i(uniform('readingPalette'),2);gl.uniform2f(uniform('spriteAspect'),1,1);gl.enable(gl.RASTERIZER_DISCARD);
      const rows=[];
      for(const seconds of [0,2,150/19-.001,150/19+.001,375/94-.001,375/94+.001]){
        gl.uniform1f(uniform('time'),seconds);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,2);gl.endTransformFeedback();
        const values=new Float32Array(8);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,values);rows.push({seconds,values:[...values]});
      }
      const debug=gl.getExtension('WEBGL_debug_renderer_info');return {rows,error:gl.getError(),sourceUnchanged:source===gl.getShaderSource(shaders[0]),vertexSource:source,backend:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION)};
    }finally{
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null);gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,originalTF);gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,originalTFBuffer);gl.bindVertexArray(originalVAO);gl.bindBuffer(gl.ARRAY_BUFFER,originalBuffer);gl.useProgram(originalProgram);
      if(!originalDiscard)gl.disable(gl.RASTERIZER_DISCARD);
      if(tf)gl.deleteTransformFeedback(tf);if(output)gl.deleteBuffer(output);if(input)gl.deleteBuffer(input);if(vao)gl.deleteVertexArray(vao);if(program)gl.deleteProgram(program);for(const shader of shaders)gl.deleteShader(shader);
    }
  });
  return result;
}
