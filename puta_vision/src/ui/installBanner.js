// Banner "instalar en pantalla de inicio" (SPEC F6). Chrome/Android dispara
// `beforeinstallprompt` cuando la PWA es instalable pero no fue instalada
// todavía; por defecto el navegador mostraría su propio mini-banner, así que
// prevenimos ese default y guardamos el evento para disparar el prompt nativo
// desde nuestro propio botón, en el momento que el usuario elija.
// iOS Safari no dispara este evento (no soporta instalación programática):
// ahí el banner no aparece nunca, que es el comportamiento esperado.
export function setupInstallBanner(banner, installBtn, dismissBtn){
  let deferredPrompt = null;

  function show(){ banner.hidden = false; }
  function hide(){ banner.hidden = true; }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    show();
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) { hide(); return; }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    hide();
  });

  dismissBtn.addEventListener('click', hide);

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hide();
  });
}
