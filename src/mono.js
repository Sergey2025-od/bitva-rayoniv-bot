//
// DISTRICT MATCH
//
let districtCode = null;

if (
  text.includes("черем") ||
  text.includes("черьому")
) {
  districtCode = "cheremushki";
}

if (
  text.includes("молд")
) {
  districtCode = "moldovanka";
}

if (
  text.includes("арк")
) {
  districtCode = "arkadia";
}

if (
  text.includes("таір") ||
  text.includes("таир") ||
  text.includes("лиман") ||
  text.includes("сав")
) {
  districtCode = "tairchik";
}

if (
  text.includes("центр")
) {
  districtCode = "center";
}

if (
  text.includes("слобод")
) {
  districtCode = "slobodka";
}

if (
  text.includes("перес")
) {
  districtCode = "peresyp";
}

if (
  text.includes("поскот")
) {
  districtCode = "poskot";
}

if (
  text.includes("аванг") ||
  text.includes("7 км") ||
  text.includes("ленпас")
) {
  districtCode = "avangard";
}

if (
  text.includes("крива") ||
  text.includes("усат") ||
  text.includes("неруб")
) {
  districtCode = "krivaya";
}

if (
  text.includes("холод") ||
  text.includes("дачн")
) {
  districtCode = "holodka";
}
