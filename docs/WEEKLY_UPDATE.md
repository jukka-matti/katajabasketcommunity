# Viikkopäivityksen käyttöönotto

Käyttäjän valinta on yksi paikallinen viikkoajo. Oletusaika on maanantai klo 06.00 Suomen aikaa (`0 6 * * 1`, `Europe/Helsinki`). GitHub Actions tarkistaa sivustoa, mutta ei hoida tiedonhakua tai sen ajastusta.

## Ensin valmisteltavat asiat

1. Ota käyttöön molempien repoiden yhteensopivat muutokset. Sivustorepossa pitää olla tietosopimuksen mukainen `data/latest.json` jo ennen ensimmäistä julkaisua.
2. Käynnistä n8n-repon `experiments/basket-monitor` sen README:n ohjeella omalla koneellasi. Palvelu käyttää loopback-osoitetta ja omaa paikallista datahakemistoa.
3. Määrittele workerin paikallinen API-avain ja liitä se n8n:n HTTP Header Auth -tunnukseen. Avainta ei kirjoiteta työnkulun JSON-tiedostoon.
4. Luo GitHubin hienojakoinen token, jonka repository on **vain `jukka-matti/katajabasketcommunity`** ja oikeus **Contents: write**. Aseta se workerin paikalliseen ympäristöön workerin README:n ohjeen mukaan.
5. Tuo `basket-monitor`-kansion n8n-työnkulku omaan n8n:ään. Valitse HTTP-solmuille paikallinen API-tunnus.

## Ensimmäinen ajo

Suorita tiedonkeruu ensin käsin. Tarkista, että sarja, kausi, joukkueiden nimet, päivät, pisteiden koti/vieras-järjestys ja kattavuus vastaavat lähdettä. Ensimmäinen adapteri kattaa edustusjoukkueen ottelut ja tulokset; se ei väitä juniorien tai sarjataulukoiden lähteitä valmiiksi.

Julkaisu on oletuksena pois päältä, joten ensimmäinen ajo päättyy tilaan **Collected locally**. Kun olet tarkistanut aineiston ja GitHub-tunnuksen, aseta workerin paikalliseen `.env`-tiedostoon `BASKET_PUBLISH_ENABLED=true`. Suorita `docker compose up -d` workerin kansiossa ja käynnistä työnkulku uudelleen **Run now** -painikkeella.

Julkaisuvaiheen tulee saada onnistuneen keruun tunniste ja julkaista vain kyseinen tarkistettu live-aineisto. Tyhjää, kuvitteellista tai vanhaa ehdokasta ei julkaista. Varmista GitHubista, että commit muuttaa vain `data/latest.json`-tiedostoa ja sivustorepon tarkistukset onnistuvat.

Ehdokkaan enimmäisikä on 24 tuntia. Tätä vanhemman aineiston kohdalla suorita uusi keruu. Jatkuvuustarkistus pysäyttää päivityksen myös, jos aiemmin katettu joukkue katoaa, saman kauden ottelurivejä häviää odottamatta, valmis tulos puuttuu tai lähde palauttaa aiempaa vanhemman kauden. Tarkista tällöin lähde ja paikallinen virhekoodi.

Tämän jälkeen julkaise/aktivoi työnkulku paikallisessa n8n:ssä. Gitissä oleva työnkulku on tarkoituksella pois käytöstä ja ilman tunnuksia: repon muutos ei itsessään aktivoi koneella mitään.

Jet Set- ja Winter Basket -sivujen sisältöä ylläpidetään erikseen sivustorepon `data/events.json`-tiedostossa. Viikoittainen ottelupäivitys säilyttää tapahtumatekstit ja historian.

## Viikoittainen toiminta

Pidä n8n ja Docker käynnissä sovittuna aikana. Jos kone on pois päältä, sivusto käyttää edelleen edellistä aineistoa. Käynnistä Run now, kun kone on taas käytettävissä ja haluat tehdä väliin jääneen ajon.

Jos automaatio ilmoittaa virheestä, tarkista ensin paikallisen ajon virhekoodi. Älä korjaa tilannetta muuttamalla päivitysaikaa käsin tai korvaamalla live-tiedostoa demolla. Lähteen HTML-muutokset korjataan adapterissa, ei n8n:n solmuihin hajautetuilla tekstikäsittelyillä.

## Hosting

Sivuston build tuottaa `dist/`-hakemiston. Hosting voidaan myöhemmin liittää tämän repon muutoksiin esimerkiksi tavallisena staattisena julkaisuna. Haku pysyy silti paikallisena ja viikoittaisena. Tämän ensimmäisen muutoksen mukana ei rekisteröidä verkkotunnusta tai aktivoida hosting-palvelua.

## Viralliset tekniset ohjeet

- [n8n Schedule Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/): ajastus ja työnkulun julkaiseminen.
- [n8n: ajastuksen aikavyöhyke](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/common-issues/): työnkulun timezone-asetus.
- [GitHub Contents API](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents): tiedoston SHA ja Contents: write -oikeus.
