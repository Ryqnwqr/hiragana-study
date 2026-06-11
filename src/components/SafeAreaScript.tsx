export function SafeAreaScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){
  var probe=document.createElement('div');
  probe.style.cssText='position:fixed;bottom:0;left:0;width:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden';
  document.documentElement.appendChild(probe);
  var sab=probe.getBoundingClientRect().height||0;
  probe.remove();
  if(sab===0&&(window.navigator.standalone===true||window.matchMedia('(display-mode:standalone)').matches)){
    sab=34;
  }
  document.documentElement.style.setProperty('--sab',sab+'px');
})();`,
      }}
    />
  );
}
