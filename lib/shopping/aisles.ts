/**
 * Groups shopping items by supermarket aisle so the list matches the order you
 * actually walk a shop. Keyword matching, deliberately — it costs nothing, runs
 * offline, and a wrong guess only misfiles a line rather than losing it.
 */

export const AISLES = [
  "Fruit & veg",
  "Meat & fish",
  "Dairy & eggs",
  "Bakery",
  "Frozen",
  "Pantry",
  "Spices & sauces",
  "Drinks",
  "Other",
] as const;

export type Aisle = (typeof AISLES)[number];

const KEYWORDS: [Aisle, string[]][] = [
  [
    "Fruit & veg",
    ["onion", "garlic", "tomato", "potato", "carrot", "pepper", "chilli", "chili",
     "lettuce", "spinach", "kale", "cabbage", "broccoli", "cauliflower", "cucumber",
     "courgette", "zucchini", "aubergine", "eggplant", "mushroom", "lemon", "lime",
     "orange", "apple", "banana", "berry", "berries", "strawberr", "blueberr",
     "avocado", "ginger", "herb", "parsley", "coriander", "cilantro", "basil",
     "mint", "thyme", "rosemary", "dill", "spring onion", "scallion", "leek",
     "celery", "corn", "pea", "bean sprout", "salad", "rocket", "arugula",
     "shallot", "squash", "pumpkin", "sweet potato", "beet", "radish", "mango",
     "pineapple", "grape", "peach", "pear", "cherry", "watermelon"],
  ],
  [
    "Meat & fish",
    ["chicken", "beef", "pork", "lamb", "turkey", "duck", "mince", "steak",
     "bacon", "sausage", "ham", "salami", "chorizo", "prosciutto", "fish",
     "salmon", "tuna", "cod", "prawn", "shrimp", "squid", "calamari", "mussel",
     "scallop", "crab", "lobster", "anchov", "thigh", "breast", "wing", "rib"],
  ],
  [
    "Dairy & eggs",
    ["milk", "cream", "butter", "cheese", "yoghurt", "yogurt", "egg", "mozzarella",
     "parmesan", "cheddar", "feta", "halloumi", "ricotta", "mascarpone",
     "creme fraiche", "crème fraîche", "buttermilk", "ghee"],
  ],
  [
    "Bakery",
    ["bread", "bun", "roll", "baguette", "tortilla", "wrap", "pita", "naan",
     "brioche", "croissant", "sourdough", "focaccia", "breadcrumb", "panko"],
  ],
  [
    "Frozen",
    ["frozen", "ice cream", "peas frozen", "puff pastry", "filo", "phyllo"],
  ],
  [
    "Pantry",
    ["flour", "sugar", "rice", "pasta", "noodle", "spaghetti", "penne", "orzo",
     "udon", "ramen", "couscous", "quinoa", "lentil", "chickpea", "bean", "oat",
     "cornflour", "cornstarch", "baking powder", "baking soda", "yeast", "stock",
     "broth", "tin", "can", "tinned", "canned", "coconut milk", "passata",
     "tomato paste", "peanut butter", "honey", "syrup", "chocolate", "cocoa",
     "vanilla", "nut", "almond", "cashew", "walnut", "pecan", "sesame seed",
     "raisin", "date", "tofu", "gelatin", "cracker"],
  ],
  [
    "Spices & sauces",
    ["salt", "pepper", "spice", "paprika", "cumin", "coriander seed", "turmeric",
     "cinnamon", "nutmeg", "oregano", "chilli flake", "chili flake", "curry",
     "garam masala", "soy sauce", "fish sauce", "oyster sauce", "vinegar",
     "mustard", "ketchup", "mayo", "mayonnaise", "sriracha", "gochujang",
     "miso", "tahini", "harissa", "pesto", "hot sauce", "worcestershire",
     "oil", "olive oil", "sesame oil", "stock cube", "bay leaf", "seasoning"],
  ],
  [
    "Drinks",
    ["water", "wine", "beer", "juice", "coffee", "tea", "soda", "cola", "stock water"],
  ],
];

const CACHE = new Map<string, Aisle>();

export function aisleFor(name: string): Aisle {
  const key = name.trim().toLowerCase();
  const cached = CACHE.get(key);
  if (cached) return cached;

  let best: Aisle = "Other";
  let bestLength = 0;

  for (const [aisle, words] of KEYWORDS) {
    for (const word of words) {
      // Longest match wins: "sweet potato" should beat "potato", and
      // "sesame oil" should beat "oil".
      if (key.includes(word) && word.length > bestLength) {
        best = aisle;
        bestLength = word.length;
      }
    }
  }

  CACHE.set(key, best);
  return best;
}

/** Aisle order for display — roughly the order you walk a supermarket. */
export function sortAisles(a: Aisle, b: Aisle): number {
  return AISLES.indexOf(a) - AISLES.indexOf(b);
}
