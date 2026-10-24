# Jet Set ja Winter Basket: tapahtumasivujen ylläpito

Tapahtumien tarkoitus on koota ihmiset pelaamaan ja katsomaan, helpottaa osallistumista sekä säilyttää turnausten historia. Sivulla on pysyvä esittely ja erikseen kunkin vuoden tiedot. Tietoja ylläpidetään tämän repon `data/events.json`-tiedostossa. Paikallinen viikkotyö päivittää vain otteluaineistoa eikä muuta tapahtumia.

## Osoitteet ja sisältö

Build luo jaettavat sivut polkuihin:

- `/tapahtumat/jet-set-katukoris/`
- `/tapahtumat/winter-basket/`

Molemmat sisältävät oman sivuotsikon, kuvauksen ja Open Graph -metatiedot. Sivusto toimii myös hostauksen alipolussa. Päänavigaation **Tapahtumat** avaa tapahtumien yhteisen hakemiston. Verkkotunnus ja hosting kytketään erikseen.

Tapahtuma sisältää esittelytekstit, viimeisimmän vahvistetun tai seuraavan turnauksen, joukkuelistan, ohjelman, tulokset ja historian. Paikkakortin Maps-linkki edellyttää varmennettua katuosoitetta. Puuttuvat joukkueet tai voittajat eivät muutu arvatuiksi tiedoiksi.

## Ensimmäisen koosteen lähdepohja, tarkistettu 24.10.2026

### Jet Set -katukoris

[FairGamen vuoden 2026 turnaussivu](https://fairgame.is/en/tournaments/ip/jet-set-3x3-katukoris) ilmoittaa päiväksi 5.9.2026 ja paikaksi Motonet Areenan. Julkaistussa aineistossa on 13 joukkuetta: seitsemän Fun- ja kuusi Pro-sarjassa. Ohjelmassa on 36 ottelua. Ensimmäiset alkavat klo 12.00, viimeiset klo 14.45; jälkimmäinen ei tarkoita tapahtuman päättymisaikaa.

[Sarjataulukossa](https://fairgame.is/en/tournaments/ip/jet-set-3x3-katukoris/standings) Pro-sarjan ensimmäinen on Ukon Relocation (5 voittoa) ja Fun-sarjan ensimmäinen BC Kolmen pisteen krapu (6 voittoa). Sivusto merkitsee ne nimenomaan **sarjataulukon ensimmäisiksi**, koska erillistä mestaruuden vahvistusta ei ole tarkistettu. FairGame on tämän vuosikoosteen nimetty lähde; tietoja ei esitetä sivuston omana reaaliaikaisena tulospalveluna.

[Katajan vuoden 2010 uutinen](https://www.katajabasket.fi/edustusjoukkue/uutiset/2010-11/uutiset553.php) kertoo 19. turnauksesta ja finaalien tuloksista. [Riverian vuoden 2023 artikkeli](https://riveria.fi/riveria-katukoristurnauksessa/) dokumentoi henkilöstön ja opiskelijoiden osallistumisen. Historia ei päättele perustamisvuotta järjestyskerrasta eikä heittokisan voittajaa turnauksen voittajaksi.

### Winter Basket

[Basket.fi:n vuoden 2025 ilmoitus](https://basket.fi/uutiset/tervetuloa-lauantaina-15-2-joensuussa-motonet-areenalla-pelattavaan-talven-kovimpaan-3x3-korismitteloon/) kertoo kolmannesta Winter Basketista 15.2.2025 klo 12 Motonet Areenalla. Järjestäjä oli Kataja Basket Talents. [ISYYn helmikuun 2023 tiedote](https://www.isyy.fi/ajankohtaista/uutiskirje/uutiskirjearkisto/isyyn-uutiskirje-wiikko-arsyke-joensuu-viikko-62023.html) vahvistaa vuoden 2023 tapahtuman 25.2. klo 13.

Seuraavaa Winter Basketin päivämäärää tai ilmoittautumista ei ole vahvistettu tähän koosteeseen. Siksi `currentEdition` on tilassa `unconfirmed`, vuosi ja pelipaikka ovat `null`, ja joukkuelista sekä tulokset ovat tyhjiä. Tämä ei väitä, ettei järjestäjä olisi julkaissut tietoa muussa kanavassa.

Vuodelle 2026 löytyy myös [Spring Basket -tapahtuma 9.5.2026](https://juniorit.katajabasket.fi/pages/springbasket). Sitä ei ole merkitty Winter Basketin vuosikerraksi: lähde ei tässä tarkistuksessa vahvistanut tapahtumien olevan sama jatkumo tai nimenvaihdos.

## Uuden vuosikerran lisääminen

1. Lisää järjestäjän julkaisu `sources`-listaan: yksilöivä `id`, kuvaava `label`, HTTPS-osoite ja oikea `checkedAt`-tarkistuspäivä.
2. Siirrä päättynyt vuosikerta `history`-listaan lähdeviitteineen. Säilytä todetut tulokset ja lisää haluttaessa linkki järjestäjän valokuviin tai raporttiin. Kuvia ei kopioida ilman käyttöoikeutta.
3. Päivitä `currentEdition`: vuosi, päivämäärän selite, varmennettu paikka sekä oikea tila. Älä päättele päivämäärää viime vuoden päivästä tai viikonpäivästä.
4. Lisää julkaistut joukkueet `teams`-listaan ja vahvistettu ohjelma `schedule`-listaan. `scheduleUrl` vie järjestäjän kokonaiseen ohjelmaan. Kellonajat esitetään Suomen aikaa.
5. Avaa ilmoittautumispainike vain tilassa `registration-open` ja lisää toimiva `registrationUrl`. Historiallinen lomake tai vanhentunut ilmoittautumispäivä ei ole nykyinen ilmoittautumislinkki.
6. Merkitse pelattu vuosikerta `completed`-tilaan. Lisää `winners`-listaan vain lähteistetty tulos ja täsmällinen sarjan/sijoituksen selite. Päivitä `updatedAt` ja aja `npm test` sekä `npm run build`.

Tilan vaihtoehdot ovat `unconfirmed`, `announced`, `registration-open`, `completed` ja `cancelled`. Lähdeviitteet yhdistävät esittelyn, vuosikerran ja historiakohdat lähderekisteriin. `assets/events.mjs` tarkistaa sisällön sekä selaimessa että buildissa; tuntematon lähde, turvaton URL tai virheellinen tietorakenne pysäyttää buildin.

Tapahtumien viestintä voi käyttää samaa pysyvää osoitetta ennen pelejä ja niiden jälkeen. Esittely kutsuu mukaan, vuosikerta kertoo ajankohdan ja osallistumisen, ja historiaan jää tieto tapahtumasta myös seuraavaa vuotta varten.
