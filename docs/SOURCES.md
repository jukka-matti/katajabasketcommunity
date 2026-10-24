# Lähteet ja kattavuus

## Varmennettu ensimmäinen lähde

[Kataja Basketin ottelusivu](https://www.katajabasket.fi/ottelut/) sisältää miesten edustusjoukkueen kauden ottelut ja julkaistut tulokset HTML-muodossa. Aidon sivun kaikki 40 otteluriviä luettiin talletetusta HTML:stä Playwrightilla ja muunnettiin onnistuneesti tietosopimukseen; mukana oli 10 julkaistua tulosta. Tämä oli tallennetun sivun tarkistus, ei käyttäjän paikallisen viikkotyön ensimmäinen tuotantoajo.

Lähde julkaisee kauden, päivän ja kuukauden, kellonajan, koti- ja vierasjoukkueen, kilpailun, pelipaikan nimen sekä tuloksen ja tilastolinkin niiden ollessa saatavilla. Tulevien otteluiden kaikilla riveillä ei ole virallista ottelutunnusta.

Otteluiden kellonajoille käytetään sovittua `Europe/Helsinki`-tulkintaa. Se on adapterin tulkintasääntö; lähteen riveissä ei ole aikavyöhykekenttää. Kesä- ja talviaika ratkaistaan aikavyöhykekirjastolla, ei vuoden ympäri kiinteällä UTC-offsetilla. Ottelun vuosi tulkitaan lähteen kaudesta, ei ajovuodesta.

## Sarjataulukot ja juniorit

Katajan nykyiseltä ottelusivulta ei löytynyt sarjataulukkoa. Myöskään etusivun tai tutkittujen ottelusivujen HTML ei tarjonnut varmennettua ajantasaista taulukkoa. Näille ei ole kirjoitettu arvattuja selektoreita.

[Koripalloliiton kuvaus palveluista](https://basket.fi/koripalloliitto/lajitietoa/seuraa-penan-kehitysta/) kertoo Tulospalvelun sisältävän kaikkien sarjojen otteluohjelmat ja sarjataulukot. Se on ensisijainen jatkotutkimuksen lähde juniorien ja sarjataulukoiden kattavuudelle. Tässä valmistelussa tavallinen Tulospalvelun Playwright-navigointi pysähtyi executorin TLS-varmennevirheeseen. Suora irrallinen rajapintakutsu palautti 403. Kumpaakaan ei ohitettu. Varsinainen ajettu DOM on siksi vielä varmistettava paikallisessa ympäristössä.

Koripalloliitto kuvaa myös [jäsenetuina tarjottavan API-yhteyden ja widgetit](https://basket.fi/korisperhe/seuroille-ja-joukkueille/palvelut-seuroille/jasenedut-ja-palkitseminen/). Jos seuran yhteys tulee myöhemmin käyttöön, se voidaan toteuttaa samaa tietosopimusta tuottavaksi adapteriksi. Sivuston rakennetta tai viikoittaista n8n-ajastusta ei tarvitse sen vuoksi muuttaa.

## Pelipaikat

[Motonet Areenan virallinen osoite](https://www.katajabasket.fi/motonet-areena/) on Kisapolku 1, 80110 Joensuu. Osoite voidaan yhdistää lähteessä esiintyvään areenan nimeen. Muiden salien nimiä ei muuteta oletetuiksi osoitteiksi tai Joensuun peleiksi.

Maps-linkit käyttävät [Google Maps URL -muotoa](https://developers.google.com/maps/documentation/urls/guide), jossa kohteena on paikan nimi ja varmennettu osoite. Karttaupotusta tai Maps API -avainta ei tarvita.

## Seuraavat konkreettiset lähdevaiheet

1. Varmista Tulospalvelun tavallinen sivulataus käyttäjän paikallisella koneella ja tallenna pieni todellinen HTML-/JSON-fixture.
2. Liitä yksi juniorijoukkue sekä sen oikea kausi, sarja ja lohko. Vertaa muutamaa ottelua käsin lähteeseen ennen kattavuuden laajentamista.
3. Lisää virallinen sarjataulukko omana lähdeaineistonaan. Jos sarja ei julkaise taulukkoa, tilaksi merkitään `not-published`.
4. Laajenna varmennettua pelipaikkarekisteriä todellisilla osoitteilla.

Kaikki uudet lähteet käyttävät samaa tietosopimusta. Selaimen ei tarvitse tietää, mistä adapterista aineisto tuli; lähdelinkit ja kattavuus näkyvät aineistossa.

## Yhteisötapahtumat

Jet Set -katukoriksen ja Winter Basketin tiedot ovat erillisessä toimituksellisessa aineistossa. Lähteet ja tarkistuspäivät löytyvät `data/events.json`-tiedostosta, sivuilta itseltään sekä [tapahtumien ylläpito-ohjeesta](EVENTS.md). Näiden tapahtumien tiedonhakua ei ole liitetty viikkoajoon.
