const axios=require('axios');
const cheerio=require('cheerio');
axios.get('https://protezionecivile.regione.lazio.it/gestione-emergenze/centro-funzionale/bollettini/rischi-incendi')
.then(r=>{
  const $=cheerio.load(r.data);
  $('a').each((i,el)=>{
    const href=$(el).attr('href');
    if(href && href.endsWith('.pdf')) {
      console.log($(el).text().trim(), href);
    }
  })
}).catch(console.error);
