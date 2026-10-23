// Configuración dinámica mínima: parte de app.json y solo añade la ruta base
// de la web cuando se exporta para GitHub Pages (PAGES_BASE_URL=/Adivina-pkm).
// En móvil y en `expo start --web` no cambia nada.
module.exports = ({ config }) => {
  const baseUrl = process.env.PAGES_BASE_URL;
  if (!baseUrl) return config;
  return {
    ...config,
    experiments: { ...(config.experiments || {}), baseUrl },
  };
};
