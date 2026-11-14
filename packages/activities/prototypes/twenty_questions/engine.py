"""Deterministic, bounded catalog engine. No services or retained player data."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Question:
    key: str
    text: str


QUESTIONS = tuple(Question(key, text) for key, text in [
    ("alive", "Is it alive?"),
    ("made", "Is it man-made?"),
    ("large", "Is it larger than a car?"),
    ("indoors", "Is it usually found indoors?"),
    ("animal", "Is it an animal?"),
    ("person", "Is it a person?"),
    ("place", "Is it a place?"),
    ("plant", "Is it a plant?"),
    ("pet", "Is it commonly kept as a pet?"),
    ("fur", "Does it have fur?"),
    ("fly", "Can it fly under its own power?"),
    ("water", "Is it mainly found in water?"),
    ("food", "Is it something people eat?"),
    ("electric", "Does it need electricity to do its main job?"),
    ("carry", "Can an adult usually carry it in one hand?"),
    ("transport", "Is its main purpose transporting people?"),
    ("music", "Is it used to make music?"),
    ("read", "Is it something people read?"),
    ("kitchen", "Is it usually used in a kitchen?"),
    ("wear", "Is it something people wear?"),
    ("wood", "Is it mainly made of wood?"),
    ("sit", "Is it something people sit on?"),
    ("wild", "Is it usually found in the wild?"),
    ("public", "Is it a place people can visit?"),
])

# A deliberately small reviewed generic catalog. Omitted traits mean No for
# this simplified model, not a universal claim about every real-world example.
CATALOG = {
    "a dog": "alive animal pet fur",
    "a cat": "alive animal pet fur carry",
    "a rabbit": "alive animal pet fur carry",
    "a parrot": "alive animal pet fly carry",
    "a goldfish": "alive animal pet water carry",
    "an elephant": "alive animal large wild",
    "a dolphin": "alive animal water wild",
    "an eagle": "alive animal fly wild",
    "a butterfly": "alive animal fly carry wild",
    "an oak tree": "alive plant large wood wild",
    "a rose": "alive plant carry",
    "a teacher": "alive person indoors",
    "an apple": "food carry kitchen",
    "a loaf of bread": "made food carry kitchen indoors",
    "a kettle": "made electric carry kitchen indoors",
    "a refrigerator": "made electric kitchen indoors",
    "a book": "made read carry indoors",
    "a phone": "made electric carry indoors",
    "a guitar": "made music wood indoors",
    "a piano": "made music wood indoors",
    "a chair": "made sit indoors",
    "a wooden stool": "made wood sit indoors",
    "a hat": "made wear carry",
    "a bicycle": "made transport",
    "a bus": "made large transport sit",
    "a library": "made large place public indoors",
    "a beach": "place public wild",
    "a mountain": "large place public wild",
}
CATALOG = {name: frozenset(traits.split()) for name, traits in CATALOG.items()}


@dataclass(frozen=True)
class Answer:
    question: Question
    yes: bool
    assumed: bool = False


class RuleEngine:
    """Ranks catalog subjects by disagreement with the complete answer history."""

    def candidates(self, history):
        scores = {
            name: sum((answer.question.key in traits) != answer.yes for answer in history)
            for name, traits in CATALOG.items()
        }
        best = min(scores.values())
        return [name for name, score in scores.items() if score == best]

    def next_question(self, history):
        if len(history) >= 20:
            raise ValueError("The 20-question limit has been reached")
        asked = {answer.question.key for answer in history}
        remaining = [q for q in QUESTIONS if q.key not in asked]
        if not history:
            return QUESTIONS[0]
        candidates = self.candidates(history)
        # Prefer the question that most evenly splits remaining best matches.
        # Catalog order breaks ties deterministically, including exhausted matches.
        return min(remaining, key=lambda q: abs(
            len(candidates) - 2 * sum(q.key in CATALOG[name] for name in candidates)
        ))

    def final_guess(self, history):
        return self.candidates(history)[0]
