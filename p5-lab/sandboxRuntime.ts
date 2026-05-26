// HTML document loaded into the sandboxed iframe that runs AI-generated
// sketches. The iframe is created with sandbox="allow-scripts" (no
// allow-same-origin), so even with `new Function` inside, the script
// cannot read parent localStorage, cookies, DOM, or make requests with
// the parent's credentials. It can only postMessage back to the parent.

// p5 is loaded from CDN inside the iframe. The page initialises an
// empty values object, listens for "init" messages with factoryCode +
// values, and "values" messages for live control updates.

export const buildSandboxDoc = (): string => `<!doctype html>
<html><head>
<meta charset="utf-8" />
<style>
  html,body{margin:0;padding:0;background:transparent;overflow:hidden;height:100%}
  canvas{display:block!important;width:100%!important;height:100%!important;object-fit:fill!important}
</style>
<script src="https://cdn.jsdelivr.net/npm/p5@1.10.0/lib/p5.min.js"></script>
</head><body>
<script>
(function(){
  var CW = 540, CH = 1040;
  var values = {};
  var instance = null;
  var getValues = function(){ return values; };

  function send(msg){ try{ parent.postMessage(msg, '*'); }catch(e){} }

  function safeCompile(factoryCode){
    try {
      // factoryCode is the arrow form: (getValues, CW, CH) => (p) => { ... }
      // Wrapping in (...) and returning evaluates the expression cleanly.
      var fn = new Function('return (' + factoryCode + ');')();
      return fn;
    } catch (err) {
      send({ kind: 'error', message: 'Compile error: ' + String(err && err.message || err) });
      return null;
    }
  }

  function mountSketch(factoryCode, initialValues){
    values = initialValues || {};
    if (instance) { try { instance.remove(); } catch(e){} instance = null; }
    var outerFactory = safeCompile(factoryCode);
    if (!outerFactory) return;
    try {
      var sketchFn = outerFactory(getValues, CW, CH);
      instance = new p5(sketchFn, document.body);
      send({ kind: 'ready' });
    } catch (err) {
      send({ kind: 'error', message: 'Runtime error: ' + String(err && err.message || err) });
    }
  }

  window.addEventListener('message', function(e){
    var msg = e.data || {};
    if (msg.kind === 'init') mountSketch(msg.factoryCode, msg.values);
    else if (msg.kind === 'values') values = msg.values || values;
  });

  window.addEventListener('error', function(e){
    send({ kind: 'error', message: 'window.error: ' + (e.message || '') });
  });

  // Once the page boots, tell the parent we're ready to receive an init.
  send({ kind: 'mounted' });
})();
</script>
</body></html>`;
