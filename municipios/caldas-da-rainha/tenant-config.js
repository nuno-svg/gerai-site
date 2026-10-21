// Public presentation only. This configuration never grants database access.
export default Object.freeze({
 id:'caldas-da-rainha', name:'Caldas da Rainha',
 teamUrl:'https://app.gerai.pt/?canal=municipios&municipio=caldas-da-rainha',
 catalogueUrl:'https://espacos.caldasreadytoinvest.pt/',
 catalogueSource:'https://espacos.caldasreadytoinvest.pt/api/listings',
 privacyEmail:'nuno@gerai.pt', languages:['pt','en'],
 // Privacy notice: a definir pela Câmara (D-3). Lines are shown only when filled; keep {pt,en} or a plain string.
 privacyController:'', retention:'',
 themeStylesheet:'tenant-theme.css', brandLogo:null,
});
