"""
Unit tests for Stage 5 LLM Judge and cascading local Ollama fallback.
"""
import json
import unittest
from unittest.mock import MagicMock, patch

from rag_ops.eval.stage_5_judge import (
    JudgeVerdict,
    _parse_ollama_json_verdict,
    get_first_ollama_model,
    is_ollama_server_running,
    run_judge,
    run_ollama_judge,
    start_ollama_server,
)


class TestStage5Judge(unittest.TestCase):

    def test_parse_ollama_json_verdict_valid(self):
        sample = json.dumps({"reasoning": "The response is accurate.", "score": 1})
        reasoning, score = _parse_ollama_json_verdict(sample)
        self.assertEqual(reasoning, "The response is accurate.")
        self.assertEqual(score, 1)

    def test_parse_ollama_json_verdict_with_codeblock(self):
        sample = '```json\n{"reasoning": "Contradicts source.", "score": 0}\n```'
        reasoning, score = _parse_ollama_json_verdict(sample)
        self.assertEqual(reasoning, "Contradicts source.")
        self.assertEqual(score, 0)

    def test_parse_ollama_json_verdict_string_score(self):
        sample = json.dumps({"reasoning": "Good output.", "score": "pass"})
        reasoning, score = _parse_ollama_json_verdict(sample)
        self.assertEqual(score, 1)

    def test_parse_ollama_json_verdict_empty(self):
        reasoning, score = _parse_ollama_json_verdict("")
        self.assertIn("Empty response", reasoning)
        self.assertEqual(score, 0)

    @patch("urllib.request.urlopen")
    def test_is_ollama_server_running_true(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_resp
        self.assertTrue(is_ollama_server_running("http://localhost:11434"))

    @patch("urllib.request.urlopen")
    def test_is_ollama_server_running_false(self, mock_urlopen):
        mock_urlopen.side_effect = Exception("Connection refused")
        self.assertFalse(is_ollama_server_running("http://localhost:11434"))

    @patch("rag_ops.eval.stage_5_judge.is_ollama_server_running")
    def test_start_ollama_server_already_running(self, mock_running):
        mock_running.return_value = True
        self.assertTrue(start_ollama_server())

    @patch("subprocess.run")
    @patch("rag_ops.eval.stage_5_judge.start_ollama_server")
    def test_get_first_ollama_model_cli(self, mock_start, mock_run):
        mock_start.return_value = True
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="NAME          ID              SIZE      MODIFIED\nqwen3.5:2b    324d162be6ca    2.7 GB    7 weeks ago\nllama3:latest 365c0bd3c000    4.7 GB    2 days ago\n",
        )
        model = get_first_ollama_model()
        self.assertEqual(model, "qwen3.5:2b")

    @patch("subprocess.run")
    @patch("urllib.request.urlopen")
    @patch("rag_ops.eval.stage_5_judge.start_ollama_server")
    def test_get_first_ollama_model_api_fallback(self, mock_start, mock_urlopen, mock_run):
        mock_start.return_value = True
        mock_run.side_effect = Exception("CLI not available")
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps({
            "models": [{"name": "mistral:latest"}]
        }).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        model = get_first_ollama_model()
        self.assertEqual(model, "mistral:latest")

    @patch("rag_ops.eval.stage_5_judge.run_ollama_judge")
    def test_run_judge_no_key_cascades_to_ollama(self, mock_ollama_judge):
        mock_ollama_judge.return_value = JudgeVerdict(
            reasoning="Evaluated by local model.",
            score=1,
            model="ollama/qwen3.5:2b",
        )
        verdict = run_judge(
            query="test query",
            answer="test answer",
            context="test context",
            api_key=None,
        )
        self.assertEqual(verdict.score, 1)
        self.assertEqual(verdict.model, "ollama/qwen3.5:2b")
        mock_ollama_judge.assert_called_once()

    @patch("rag_ops.eval.stage_5_judge.run_ollama_judge")
    def test_run_judge_explicit_ollama(self, mock_ollama_judge):
        mock_ollama_judge.return_value = JudgeVerdict(
            reasoning="Explicit ollama call.",
            score=1,
            model="ollama/llama3",
        )
        verdict = run_judge(
            query="test query",
            answer="test answer",
            context="test context",
            model="ollama/llama3",
        )
        self.assertEqual(verdict.score, 1)
        self.assertEqual(verdict.model, "ollama/llama3")
        mock_ollama_judge.assert_called_once()

    @patch("rag_ops.eval.stage_5_judge.run_ollama_judge")
    @patch("google.genai.Client")
    def test_run_judge_gemini_fails_cascades_to_ollama(self, mock_client_cls, mock_ollama_judge):
        # Gemini raises 503 error on all models
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = Exception("503 Service Unavailable")
        mock_client_cls.return_value = mock_client

        mock_ollama_judge.return_value = JudgeVerdict(
            reasoning="Ollama local fallback evaluated successfully.",
            score=1,
            model="ollama/qwen3.5:2b",
        )

        verdict = run_judge(
            query="test query",
            answer="test answer",
            context="test context",
            api_key="fake-gemini-key",
            model="gemini-3.8-flash",
        )

        self.assertEqual(verdict.score, 1)
        self.assertEqual(verdict.model, "ollama/qwen3.5:2b")
        mock_ollama_judge.assert_called_once()


if __name__ == "__main__":
    unittest.main()

