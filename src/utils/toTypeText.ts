export function toTypeText(type: string) {
  switch (type) {
    case "dataset":
      return "Datasett";
    case "series":
      return "Serie";
    case "service":
      return "Tjeneste";
    case "servicelayer":
      return "Tjenestelag";
    case "software":
      return "Programvare";
  }
  return type;
}
