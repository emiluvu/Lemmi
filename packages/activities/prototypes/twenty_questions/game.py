"""Local text-only experiment requested by Lukas; not the app activity host."""

import argparse
from pathlib import Path
import sys
from dataclasses import dataclass

# The official Windows embedded runtime omits the script directory from sys.path.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from engine import Answer, RuleEngine
from timed_input import TerminalInput


@dataclass(frozen=True)
class Config:
    response_timeout_seconds: float = 10
    max_consecutive_timeouts: int = 3

    def __post_init__(self):
        import math
        if not math.isfinite(self.response_timeout_seconds) or self.response_timeout_seconds <= 0:
            raise ValueError("Timeout must be a positive finite number")
        if self.max_consecutive_timeouts < 1:
            raise ValueError("Consecutive timeout limit must be positive")


class Game:
    def __init__(self, reader, write=print, config=None, engine=None):
        self.reader = reader
        self.write = write
        self.config = config or Config()
        self.engine = engine or RuleEngine()
        self.history = []
        self.consecutive_timeouts = 0

    def ask(self, prompt, ready=False):
        while True:
            raw = self.reader.read(prompt, self.config.response_timeout_seconds)
            if raw is None:
                return None
            value = raw.strip().lower()
            if ready and value == "ready":
                return True
            if not ready and value in ("yes", "y", "no", "n"):
                return value in ("yes", "y")
            self.write("Please type ready." if ready else "Please enter Yes or No.")

    def start(self):
        self.write("Hello! I'm LEMMI! Let's play 20 Questions!")
        self.write("Think of anything you want, but don't tell me what it is.")
        self.write("I'll ask you 20 Yes or No questions to try to guess what you're thinking of!")
        self.write("Rule-based demo: I can only guess from a small catalog; some subjects look identical to me.")
        self.write("Type 'ready' when you're ready to begin.")
        return self.ask("> ", ready=True)

    def round(self):
        self.history = []
        self.consecutive_timeouts = 0
        while len(self.history) < 20:
            question = self.engine.next_question(self.history)
            self.write(f"Question {len(self.history) + 1}/20: {question.text}")
            answer = self.ask("Your answer (yes/no): ")
            assumed = answer is None
            if assumed:
                self.write("No response detected. I'll count that as No!")
                answer = False
                self.consecutive_timeouts += 1
            else:
                self.consecutive_timeouts = 0
            self.history.append(Answer(question, answer, assumed))
            if self.consecutive_timeouts >= self.config.max_consecutive_timeouts:
                self.write("It looks like you're away. We can play again another time!")
                return False
        self.write("Alright, I've asked all 20 questions!")
        self.write(f"My final guess is... {self.engine.final_guess(self.history)}!")
        correct = self.ask("Was I right? (yes/no) ")
        if correct is None:
            return False
        if correct:
            self.write("Awesome! I guessed correctly!")
        else:
            self.write("Aw, you got me! What were you thinking of?")
            subject = self.reader.read("> ", self.config.response_timeout_seconds)
            if subject is None:
                return False
            self.write("That was a good one!")
        return True

    def run(self):
        try:
            if not self.start():
                return
            while self.round():
                if not self.ask("Would you like to play again? (yes/no) "):
                    break
                self.write("Think of a new subject.")
        except (EOFError, KeyboardInterrupt):
            self.write("\nSession ended.")
        finally:
            self.write("Thanks for playing LEMMI 20 Questions! Goodbye!")


def main():
    parser = argparse.ArgumentParser(description="LEMMI text-only 20 Questions prototype")
    parser.add_argument("--timeout", type=float, default=10, help="Response timeout in seconds")
    parser.add_argument("--max-timeouts", type=int, default=3)
    args = parser.parse_args()
    try:
        config = Config(args.timeout, args.max_timeouts)
    except ValueError as error:
        parser.error(str(error))
    Game(TerminalInput(), config=config).run()


if __name__ == "__main__":
    main()
