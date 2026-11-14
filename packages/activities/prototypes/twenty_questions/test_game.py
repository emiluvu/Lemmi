from pathlib import Path
import subprocess
import sys
import unittest

from engine import Answer, CATALOG, RuleEngine
from game import Config, Game


class ScriptedInput:
    def __init__(self, answers):
        self.answers = iter(answers)

    def read(self, prompt, timeout):
        try:
            return next(self.answers)
        except StopIteration:
            raise EOFError


class GameTests(unittest.TestCase):
    def game(self, inputs):
        output = []
        game = Game(ScriptedInput(inputs), write=output.append)
        return game, output

    def test_start_invalid_answers_limit_guess_and_exit(self):
        game, output = self.game(["wait", "READY", "maybe", " Y "] + ["n"] * 19 + ["YES", "no"])
        game.run()
        self.assertTrue(output[0].startswith("Hello!"))
        self.assertIn("Please enter Yes or No.", output)
        self.assertEqual(len(game.history), 20)
        self.assertEqual(len({a.question.key for a in game.history}), 20)
        self.assertEqual(sum(line.startswith("Question ") for line in output), 20)
        self.assertEqual(sum(line.startswith("My final guess") for line in output), 1)
        self.assertIn("Awesome! I guessed correctly!", output)
        self.assertIn("Goodbye!", output[-1])

    def test_timeout_assumption_and_three_timeout_exit(self):
        game, output = self.game([None, None, None])
        self.assertFalse(game.round())
        self.assertEqual(len(game.history), 3)
        self.assertTrue(all(a.assumed and not a.yes for a in game.history))
        self.assertFalse(any(line.startswith("My final guess") for line in output))

    def test_valid_answer_resets_timeout_counter(self):
        game, _ = self.game([None, None, "yes", None, None, None])
        game.round()
        self.assertEqual(len(game.history), 6)
        self.assertFalse(game.history[2].assumed)
        self.assertEqual(game.consecutive_timeouts, 3)

    def test_replay_clears_history_and_failed_guess_accepts_subject(self):
        game, output = self.game(["ready"] + ["no"] * 20 + ["no", "a comet", "yes"]
                                 + ["yes"] * 20 + ["yes", "no"])
        game.run()
        self.assertEqual(sum(line.startswith("Question 1/20") for line in output), 2)
        self.assertEqual(len(game.history), 20)
        self.assertTrue(all(a.yes and not a.assumed for a in game.history))
        self.assertIn("That was a good one!", output)

    def test_start_and_replay_timeout_end_session(self):
        game, output = self.game([None])
        game.run()
        self.assertEqual(game.history, [])
        game, output = self.game(["ready"] + ["no"] * 20 + ["yes", None])
        game.run()
        self.assertEqual(sum(line.startswith("Question 1/20") for line in output), 1)

    def test_closed_input_exits_gracefully(self):
        game, output = self.game([])
        game.run()
        self.assertIn("Session ended.", "\n".join(output))
        self.assertIn("Goodbye!", output[-1])

    def test_engine_uses_answers_and_keeps_best_catalog_match(self):
        engine = RuleEngine()
        first = engine.next_question([])
        self.assertNotEqual(engine.next_question([Answer(first, True)]),
                            engine.next_question([Answer(first, False)]))
        for subject, traits in CATALOG.items():
            history = []
            for _ in range(20):
                question = engine.next_question(history)
                history.append(Answer(question, question.key in traits))
            self.assertIn(subject, engine.candidates(history))
            self.assertEqual(len({a.question.key for a in history}), 20)
            with self.assertRaises(ValueError):
                engine.next_question(history)

    def test_config_validation(self):
        for value in [0, -1, float("nan"), float("inf")]:
            with self.assertRaises(ValueError):
                Config(value)
        with self.assertRaises(ValueError):
            Config(10, 0)

    def test_real_pipe_input_and_deadline_on_current_platform(self):
        # Runs the actual polling input implementation, including PeekNamedPipe
        # on Windows. Keep stdin open and silent to exercise a real deadline.
        script = str(Path(__file__).with_name("game.py"))
        process = subprocess.Popen([sys.executable, script, "--timeout", "0.15"],
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, text=True)
        try:
            process.stdin.write("ready\n")
            process.stdin.flush()
            process.wait(timeout=5)
            output = process.stdout.read()
            self.assertEqual(process.returncode, 0, process.stderr.read())
            self.assertEqual(output.count("No response detected."), 3)
            self.assertIn("It looks like you're away.", output)
            self.assertNotIn("My final guess", output)
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()
            process.stdin.close()
            process.stdout.close()
            process.stderr.close()

    def test_real_pipe_complete_round(self):
        script = str(Path(__file__).with_name("game.py"))
        result = subprocess.run([sys.executable, script],
                                input="ready\n" + "no\n" * 20 + "yes\nno\n",
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.count("Your answer (yes/no):"), 20)
        self.assertIn("My final guess", result.stdout)


if __name__ == "__main__":
    unittest.main()
