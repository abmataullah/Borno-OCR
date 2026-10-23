"""Tests for the advanced document model builder."""

import pytest
from app.document_model import (
    detect_script,
    detect_language,
    match_font,
    _group_chars_into_runs,
    _group_runs_into_lines,
    _color_to_hex,
)


def test_detect_script_bengali():
    assert detect_script("আমার নাম") == "bengali"


def test_detect_script_english():
    assert detect_script("Hello World") == "latin"


def test_detect_script_arabic():
    assert detect_script("مرحبا") == "arabic"


def test_detect_script_mixed():
    assert detect_script("Hello বাংলা") == "bengali"


def test_detect_language_bengali():
    assert detect_language("আমার নাম") == "bn"


def test_detect_language_english():
    assert detect_language("Hello World") == "en"


def test_match_font_known():
    result = match_font("NotoSansBengali", 12, "বাংলা")
    assert result["family"] == "Noto Sans Bengali"
    assert result["source"] == "embedded"


def test_match_font_substitution_bengali():
    result = match_font("UnknownFont", 12, "বাংলা")
    assert result["source"] == "substituted"
    assert result["family"] == "Noto Sans Bengali"


def test_match_font_substitution_latin():
    result = match_font("UnknownFont", 12, "Hello")
    assert result["source"] == "substituted"
    assert result["family"] == "Inter"


def test_match_font_bold():
    result = match_font("NotoSansBengali-Bold", 12, "বাংলা")
    assert result["weight"] == 700


def test_match_font_subset_prefix():
    result = match_font("ABCDEF+NotoSansBengali", 12, "বাংলা")
    assert result["family"] == "Noto Sans Bengali"


def test_color_to_hex_none():
    assert _color_to_hex(None) == "#000000"


def test_color_to_hex_rgb():
    assert _color_to_hex([1.0, 0.0, 0.0]) == "#ff0000"


def test_color_to_hex_grayscale():
    assert _color_to_hex(0.5) == "#808080"


def test_group_chars_into_runs():
    chars = [
        {"text": "H", "x0": 0, "x1": 5, "top": 0, "bottom": 10, "fontname": "Arial", "size": 12, "non_stroking_color": [0, 0, 0]},
        {"text": "i", "x0": 5, "x1": 8, "top": 0, "bottom": 10, "fontname": "Arial", "size": 12, "non_stroking_color": [0, 0, 0]},
        {"text": "!", "x0": 50, "x1": 55, "top": 0, "bottom": 10, "fontname": "Arial", "size": 12, "non_stroking_color": [0, 0, 0]},
    ]
    runs = _group_chars_into_runs(chars)
    assert len(runs) == 2
    assert runs[0]["text"] == "Hi"
    assert runs[1]["text"] == "!"


def test_group_runs_into_lines():
    runs = [
        {"text": "Line 1", "bbox": {"x": 0, "y": 0, "width": 50, "height": 12}},
        {"text": "continued", "bbox": {"x": 52, "y": 0, "width": 40, "height": 12}},
        {"text": "Line 2", "bbox": {"x": 0, "y": 20, "width": 50, "height": 12}},
    ]
    lines = _group_runs_into_lines(runs)
    assert len(lines) == 2
    assert len(lines[0]) == 2
    assert len(lines[1]) == 1
