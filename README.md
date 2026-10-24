# Kataja Basket Community

Katajan ottelut, joukkueet ja Joensuun koripallotapahtumat yhdessä paikassa: viikon pelit, Joensuussa pelattavat ottelut, joukkuesivut, viimeiset tulokset, sarjatilanne ja reitti pelipaikalle. Jet Set -katukoriksen ja Winter Basketin omat sivut kokoavat turnausten tiedot ja historian.

## Toteutus

Sivusto on kevyt HTML/CSS/JavaScript-kokonaisuus. Se lukee versionhallinnassa olevaa `data/latest.json`-otteluaineistoa ja erillistä `data/events.json`-tapahtumasisältöä. Selaimessa ei tehdä tiedonhakua Basket.fi:stä eikä yhteyttä paikalliseen n8n:ään.

**Paikallinen tiedonhaku on eri repossa:** [n8n-and-local-llm / basket-monitor](https://github.com/jukka-matti/n8n-and-local-llm/tree/main/experiments/basket-monitor). n8n käynnistää työn kerran viikossa, oletuksena maanantaisin klo 06.00 Suomen aikaa. Playwright lukee lähdesivut, Python tarkistaa aineiston ja erillinen julkaisuvaihe päivittää tämän repon datatiedoston. Ajolokit, raakasisältö ja tunnukset pysyvät paikallisina.

| Kerros | Vastuu |
|---|---|
| Logiikka | Lähteiden lukeminen, kenttien tulkinta ja aineiston tarkistus paikallisessa workerissa. |
| Data | Paikallinen viimeinen onnistunut aineisto ja julkinen, versioitu `data/latest.json`. |
| Älykkyys | Tavallinen työnkulku ei tarvitse kielimallia. |
| Orkestrointi | Paikallinen n8n, yksi viikkoajastus ja käsin käynnistettävä ajo. |
| Esitystapa | Tämän repon ottelukalenteri, joukkuesivut ja tapahtumasivut. |

## Ensimmäisen version tila

- Kalenteri ja joukkuesivut toimivat samasta tietomuodosta.
- Tapahtumissa on omat sivut Jet Set -katukorikselle ja Winter Basketille: esittely, viimeisin vahvistettu tai seuraava turnaus, joukkueet, ohjelma, tulokset ja lähteistetty historia. Viikkotyö ei muuta näitä toimituksellisia sisältöjä.
- `data/latest.json` on aluksi tyhjä: oikeita tietoja odotetaan ensimmäisestä paikallisesta ajosta.
- `data/demo.json` sisältää erilliset, näkyvästi kuvitteellisiksi merkityt esimerkit. Tyhjä tai epäonnistunut oikean aineiston lataus ei muutu automaattisesti demodataksi.
- Ensimmäinen varmennettu lähdeadapteri lukee miesten edustusjoukkueen ottelut ja julkaistut tulokset Katajan omalta ottelusivulta. Juniorit ja viralliset sarjataulukot lisätään, kun niiden luettava lähde on varmistettu.
- Sivusto näyttää aineiston oikean hakuajan ja kattavuuden. Yli kahdeksan vuorokautta vanha live-aineisto merkitään vanhentuneeksi, mutta sitä voi edelleen käyttää.
- Julkaisupalvelua ja verkkotunnusta ei ole vielä kytketty. `dist/` sopii tavalliseen staattiseen verkkohostaukseen.

## Kehitys ja tarkistus

Tarvitaan Node.js 22+ ja Python 3.12+. Tuotantosivulla ei ole pakettikirjastoriippuvuuksia.

```bash
npm test
python3 scripts/validate_data.py
npm run build
python3 -m http.server 8080 --directory dist
```

Viimeinen komento on paikallista esikatselua varten. Avaa `http://localhost:8080/`. Julkaistava hakemisto on `dist/`; koko repositorya ei tarvitse palvella verkkoon.

## Dokumentaatio

- [Arkkitehtuuri ja kahden repon työnjako](docs/ARCHITECTURE.md)
- [Viikkopäivityksen käyttöönotto](docs/WEEKLY_UPDATE.md)
- [Tietosopimus](docs/DATA_CONTRACT.md)
- [Lähteet, kattavuus ja seuraavat toteutusvaiheet](docs/SOURCES.md)
- [Tapahtumasivujen tiedot ja vuosittainen ylläpito](docs/EVENTS.md)

CI tarkistaa datan, käyttöliittymän laskentalogiikan ja staattisen buildin. Se ei aja scraperia eikä aktivoi paikallista n8n-työnkulkua.
