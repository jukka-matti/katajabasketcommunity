# Julkinen otteluaineisto, versio 1

Tuottaja on paikallinen `n8n-and-local-llm/experiments/basket-monitor`; kuluttaja on tämä sivusto. Ainoa automaattisesti päivittyvä tiedosto on `data/latest.json`. Formaali rakenne on [JSON Schemassa](../schema/snapshot-v1.schema.json), ja [validoija](../scripts/snapshot_validation.py) tarkistaa myös tietueiden väliset viittaukset.

## Ylätason kentät

| Kenttä | Sisältö |
|---|---|
| `schemaVersion` | Kokonaisluku `1`. |
| `mode` | `empty`, `demo` tai `live`. Julkaisija hyväksyy vain `live`-tilan. |
| `generatedAt` | Aikavyöhykkeen sisältävä ISO 8601 -aikaleima, tyhjässä alkutilassa `null`. |
| `timezone` | `Europe/Helsinki`. |
| `sources` | Lähteen tunnus, nimi, HTTPS-osoite ja oikea hakuaika. |
| `teams` | Joukkueiden tunnukset, nimet, ikäryhmä, seurataanko joukkuetta ja kilpailut. Sisältää myös otteluissa esiintyvät vastustajat. |
| `competitions` | Sarjan tunnus, nimi, kausi ja vaihe/lohko. |
| `venues` | Pelipaikan tunnus, nimi sekä kaupunki ja osoite, jos ne on varmennettu. |
| `matches` | Ottelun tunnus, kilpailu, koti- ja vierasjoukkue, aika, tila, paikka, pisteet ja lähde. |
| `standings` | Kilpailukohtainen julkaistu sarjataulukko tai selvä tieto sen puuttumisesta. |
| `coverage` | Ne seurattavat joukkueet, jotka tässä aineistossa todella tarkistettiin, sekä tarvittava kattavuushuomautus. |

Tyhjän alkutilan kaikki tietuelistat ovat tyhjiä. `data/latest.json` hyväksyy tyhjän alkutilan tai live-aineiston, `data/demo.json` vain demoaineiston. Sivusto ei siirry demoon automaattisesti virhetilanteessa.

## Ottelut

`homeTeamId` ja `awayTeamId` kuvaavat lähteen koti/vieras-järjestystä. `homeScore` ja `awayScore` ovat saman järjestyksen pisteet. `status` on `scheduled`, `final`, `postponed`, `cancelled` tai `time-tbc`. Tulevan tai muuten ei-päättyneen ottelun pisteet ovat molemmat `null`; nolla ei tarkoita puuttuvaa tulosta.

`startsAt` sisältää todellisen UTC-offsetin tai on `null`, kun aikaa ei tiedetä. Kellonaikaa ei keksitä. Jokainen ottelu viittaa olemassa olevaan kilpailuun, kahteen eri joukkueeseen ja lähteeseen. Paikkaviittaus saa olla `null`.

Virallinen tunnus säilytetään, kun lähde tarjoaa sen. Muissa tapauksissa tunnus on oman tilannekuvan yksilöivä avain. Sivusto vaihtaa koko aineiston, joten vanhoja ottelurivejä ei yhdistetä uuteen tiedostoon tunnisteiden perusteella. Pitkäikäiset kalenteritilausten tunnisteet vaativat jatkossa virallisen lähdetunnuksen tai erikseen toteutetun täsmäytyksen.

## Sarjatilanne

Taulukon `status` on `available`, `not-published` tai `unavailable`. Vain saatavilla oleva taulukko sisältää rivejä. Jokainen rivi sisältää sijoituksen, joukkuetunnuksen, ottelut, voitot, tappiot ja sarjapisteet (`null`, jos lähteessä ei ole pistekenttää).

Sarjataulukkoa ei lasketa seuran yksittäisistä tuloksista. Taulukko kiinnitetään oikeaan kilpailuun, kauteen ja vaiheeseen. Virallisen taulukon puuttuessa sivu kertoo tiedon puuttuvan; puuttuva arvo ei muutu nollaksi tai viimeiseksi sijoitukseksi.

## Pelipaikat, kattavuus ja julkaisu

Osoitteen puuttuessa Maps-reittilinkkiä ei muodosteta arvauksesta. Paikkakuntarajaus perustuu varmennettuun `city`-kenttään, ei pelkkään kotiottelu-merkintään.

`tracked: true` määrittää sivuston omat joukkueet. `coverage.teamIds` kertoo tarkistetut joukkueet. Kattavuuden ulkopuolella olevan joukkueen tyhjä ottelulista tarkoittaa puuttuvaa tietoa. Lähteiden hakuajat eivät saa olla tilannekuvan muodostamisajan jälkeen.

Validointi hylkää tuntemattomat kentät ja versiot, päällekkäiset tunnukset, rikkinäiset viittaukset, aikavyöhykkeettömät ajat ja ristiriitaiset tuloskentät. Epäonnistunut haku ei kirjoita tyhjää tiedostoa vanhan päälle. Julkaisija validoi aineiston ennen GitHub-päivitystä ja käyttää nykyisen kohdetiedoston SHA-tunnusta.

## Sopimuksen ylläpito

`scripts/snapshot_validation.py` ja `schema/snapshot-v1.schema.json` vastaavat tuottajarepon validoijaa ja schemaa. Kun sopimus muuttuu, päivitä molemmat repositoriot yhdessä ja varmista sekä nykyinen aineisto että demo ennen julkaisua.
