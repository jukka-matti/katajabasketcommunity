# Arkkitehtuuri: paikallinen viikkotyö ja erillinen sivusto

## Päätös

Tiedonhaku pysyy paikallisessa n8n-ympäristössä ja `jukka-matti/n8n-and-local-llm`-repossa. Sivusto ja sen tarvitsema julkinen aineisto ovat `jukka-matti/katajabasketcommunity`-repossa. Haku ajetaan kerran viikossa. Oletus on maanantai klo 06.00, aikavyöhyke `Europe/Helsinki`; aikaa voi muuttaa n8n-työnkulun asetuksissa.

Tämä on deterministinen työnkulku. Playwright lukee lähdesivut, Python tulkitsee ja tarkistaa tiedot, n8n käynnistää vaiheet. Kielimallia, agenttikehystä tai uutta pilviajastusta ei tarvita.

## Repojen rajapinta

Rajapinta on yksi versioitu tiedosto: `data/latest.json`, tietosopimuksen versio 1.

| n8n-repo ja paikallinen kone | Sivustorepo |
|---|---|
| Lähdeadapterit ja Playwright | HTML, CSS ja selaimen JavaScript |
| Viikoittainen n8n-työnkulku | Kalenteri, joukkuesivut ja tapahtumasivut |
| Kenttien tulkinta ja validointi | Saman tietosopimuksen validointi CI:ssä |
| Paikallinen viimeinen onnistunut snapshot ja ajolokit | Valmis `data/latest.json` ja sen Git-historia |
| GitHub-julkaisun tunnus paikallisessa ympäristössä | Ei scraper-tunnuksia tai yhteyttä paikalliseen koneeseen |

Tietosopimus on molemmissa repoissa. Muutokset sen versioon ja kenttiin tehdään sovitetuissa PR:issä. Julkaisija hylkää tuntemattoman version, tyhjän aineiston ja demoaineiston. Sivustorepon tarkistin estää virheellisen aineiston päätymisen buildiin.

Jet Set -katukoriksen ja Winter Basketin tekstit, turnaustiedot ja historia ovat erillisessä `data/events.json`-tiedostossa. Niitä ylläpidetään sivustorepon muutoksina. Viikkotyön julkaisija ei voi muuttaa tätä tiedostoa. Tapahtumat toimivat myös ennen ensimmäistä otteluhakua tai otteluaineiston latauksen epäonnistuessa.

## Yksi ajo

1. n8n:n viikkoajastus tai Run now kutsuu paikallista tiedonkeruuta.
2. Worker lukee ennalta määritellyn julkisen lähteen ja muuntaa kentät yhteiseen tietomuotoon.
3. Tarkistus varmistaa esimerkiksi joukkueviittaukset, aikavyöhykkeet, tulokset ja ilmoitetun kattavuuden. Vasta onnistunut kokonaisuus tallennetaan viimeiseksi onnistuneeksi aineistoksi.
4. Julkaisuvaihe lukee kohderepon nykyisen `data/latest.json`-tiedoston ja sen SHA-tunnuksen. Se päivittää vain tämän tiedoston GitHubin Contents API:n kautta.
5. Sivustorepon CI tarkistaa aineiston ja rakentaa staattisen sivuston. Varsinainen hosting kytketään erikseen valittuun palveluun.

GitHubin päivityksessä käytetään luettua SHA-tunnusta. Jos kohde on sillä välin muuttunut, ajo keskeytyy ristiriitaan; päivitystä ei pakoteta toisen muutoksen yli. Julkaisijan kohderepo ja tiedostopolku on rajattu koodissa. Tunnuksen oikeudet rajataan tähän repositoryyn, Contents: write -tasoon.

## Aineisto on kokonainen tilannekuva

Jokainen onnistunut julkaisu korvaa koko julkisen tilannekuvan. Sivusto ei yhdistä peräkkäisten tiedostojen ottelurivejä. Näin edellisen viikon rivi ei jää ylimääräiseksi tapahtumaksi, kun lähde muuttaa pelipäivää.

Virallinen ottelutunnus säilytetään, kun lähde julkaisee sen. Katajan oman ottelusivun kaikilla tulevilla otteluilla ei ole virallista tunnusta. Niille voidaan käyttää snapshotin sisäistä yksilöivää tunnistetta. Tällainen tunniste ei lupaa pysyvää kalenteritilauksen UID:tä tai ottelukohtaista osoitetta yli aikataulumuutosten. Näitä ominaisuuksia ei ensimmäisessä versiossa ole.

## Virhetilanteet ja tuoreus

- Keruun tai tarkistuksen epäonnistuessa edellinen onnistunut aineisto ja sen oikea aikaleima säilyvät.
- GitHub-julkaisun epäonnistuessa paikallinen onnistunut aineisto säilyy myöhempää julkaisuyritystä varten. Jos kirjoituspyyntö aikakatkaistaan, etäpäivitys on voinut jo onnistua: saman aineiston uusintayritys lukee nykyisen sisällön ja tunnistaa jo tehdyn päivityksen ilman uutta kirjoitusta.
- Keruu ja julkaisu vertaavat ehdokasta edelliseen onnistuneeseen aineistoon. Kattavuuden katoaminen, saman kauden odottamaton ottelumäärän pieneneminen, aiemmin valmiin tuloksen katoaminen tai kauden taantuminen pysäyttävät päivityksen. Oikea lähteestä poistettu ottelu käsitellään tarkistettavana muutoksena.
- Yli 24 tuntia vanhaa keruuehdokasta ei julkaista; silloin tiedot haetaan uudelleen. Sivuston lukijoille yli kahdeksan vuorokautta vanha julkaistu aineisto merkitään vanhentuneeksi.
- Jos kone nukkuu tai n8n/Docker ei ole käynnissä, haku ei toteudu. Run now mahdollistaa korvaavan ajon. Sivusto ei ole riippuvainen koneen jatkuvasta käynnissäolosta.
- Näkyvä päivitysaika perustuu lähdehakuun. Sivun avaaminen tai build ei muuta sitä uudeksi.
- Puuttuva joukkuelähde ei tarkoita, ettei joukkueella ole pelejä. `coverage` kertoo tarkistetut joukkueet. Ensimmäinen adapteri on rajattu edustusjoukkueeseen.
- Sarjatilanne näytetään lähteen julkaisemana oikeassa sarjassa ja vaiheessa. Sijoituksia ei päätellä pelkistä ottelutuloksista.

## Esitystapa

Kalenteri rajaa saman aineiston viikolle, paikkakunnalle ja joukkueelle. Joukkuesivu näyttää seuraavat ottelut, viimeiset tulokset ja saatavilla olevan sarjataulukon. Päivät ja kellonajat esitetään Suomen ajassa. Maps-linkki muodostetaan vain varmennetusta osoitteesta.

Tapahtumasivut kokoavat osallistumistiedot ja historian saman pysyvän osoitteen alle. Build tuottaa kummallekin oman HTML-alisivun ja jakamista tukevat otsikko- ja kuvausmetatiedot. Julkistamaton päivämäärä, joukkuelista tai tulos säilyy puuttuvana tietona. Ilmoittautumislinkki näkyy vain erikseen vahvistetussa avoimessa ilmoittautumisvaiheessa.

Julkaistava sivusto on staattinen. Sen tarvitsema luku tapahtuu samasta palvelusta kuin sivun muut tiedostot. Tilastopalveluun tai paikalliselle koneelle ei tehdä pyyntöjä jokaisen sivukävijän vuoksi.
