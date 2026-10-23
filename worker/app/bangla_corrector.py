"""Bangla OCR post-correction module.

Corrects common OCR errors specific to Bangla script using:
1. Character confusion matrix (visually similar Bangla characters)
2. Context-based correction using n-gram frequency
3. Dictionary-based spell correction
4. Common word pattern fixes

Bangla OCR commonly confuses:
- ব (ba) ↔ ব (ba) — same char, but sometimes misread
- ক (ka) ↔ ক (ka) with matra
- ত (ta) ↔ থ (tha) — very similar
- শ (sha) ↔ ষ (ssa) ↔ স (sa) — similar sounds
- ড (da) ↔ ঢ (dha) — similar shape
- ন (na) ↔ ণ (na) — similar shape
- ম (ma) ↔ ভ (bha) — similar in some fonts
- ০ (0) ↔ ০ — Bangla vs English digits
- Matra (horizontal line) detection and fixing
"""

import logging
import re
import unicodedata
from collections import Counter
from typing import Any

logger = logging.getLogger(__name__)

# Common Bangla character confusions in OCR
CHAR_CONFUSIONS: dict[str, list[str]] = {
    "ত": ["থ", "ত"],
    "থ": ["ত", "থ"],
    "শ": ["ষ", "স", "শ"],
    "ষ": ["শ", "স", "ষ"],
    "স": ["শ", "ষ", "স"],
    "ড": ["ঢ", "ড"],
    "ঢ": ["ড", "ঢ"],
    "ন": ["ণ", "ন"],
    "ণ": ["ন", "ণ"],
    "ম": ["ভ", "ম"],
    "ভ": ["ম", "ভ"],
    "গ": ["ঘ", "গ"],
    "ঘ": ["গ", "ঘ"],
    "চ": ["ছ", "চ"],
    "ছ": ["চ", "ছ"],
    "জ": ["ঝ", "জ"],
    "ঝ": ["জ", "ঝ"],
    "দ": ["ধ", "দ"],
    "ধ": ["দ", "ধ"],
    "প": ["ফ", "প"],
    "ফ": ["প", "ফ"],
    "ব": ["ভ", "ব"],
    "ল": ["ল"],
    "ঙ": ["ঞ", "ঙ"],
    "ঞ": ["ঙ", "ঞ"],
    "ৎ": ["ৎ", "ত"],
    "ং": ["ঃ", "ং"],
    "ঃ": ["ং", "ঃ"],
    "ঁ": ["ং", "ঁ"],
}

# Bangla to English digit mapping
BANGLA_TO_EN_DIGIT = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
}

# English to Bangla digit mapping
EN_TO_BANGLA_DIGIT = {v: k for k, v in BANGLA_TO_EN_DIGIT.items()}

# Common Bangla words (frequent words that should be recognized correctly)
COMMON_BANGLA_WORDS = {
    "এবং", "হয়", "করে", "হতে", "এই", "সেই", "যে", "তা", "না", "হয়ে",
    "করা", "হবে", "তার", "তিনি", "তারা", "আমরা", "আপনি", "তোমরা",
    "একটি", "দুটি", "অনেক", "কিছু", "সব", "কোনো", "যেকোনো", "প্রতিটি",
    "মধ্যে", "জন্য", "সাথে", "উপর", "নিচে", "ভিতরে", "বাইরে", "পরে",
    "আগে", "পূর্বে", "এখন", "তখন", "যখন", "কখন", "সবসময়", "কখনো",
    "হইবে", "করিবে", "যাইবে", "আসিবে", "দেখিবে", "পাইবে",
    "রাষ্ট্র", "সরকার", "মন্ত্রী", "প্রধান", "রাষ্ট্রপতি", "প্রতিমন্ত্রী",
    "বাংলাদেশ", "ঢাকা", "চট্টগ্রাম", "রাজশাহী", "খুলনা", "বরিশাল", "সিলেট", "রংপুর", "ময়মনসিংহ",
    "শিক্ষা", "স্বাস্থ্য", "অর্থনীতি", "কৃষি", "বাণিজ্য", "শিল্প",
    "আইন", "বিচার", "আদালত", "সংবিধান", "সংসদ", "নির্বাচন",
    "যোগাযোগ", "পরিবহন", "যাত্রী", "টিকিট", "বাস", "ট্রেন", "বিমান",
    "নাম", "ঠিকানা", "ফোন", "তারিখ", "স্বাক্ষর", "ছবি",
    "জন্ম", "মৃত্যু", "বিবাহ", "ডিগ্রী", "প্রতিষ্ঠান", "ফলাফল",
}

# Common Bangla word prefixes and suffixes
BANGLA_PREFIXES = ["অ", "অন", "অনু", "প্রতি", "স", "নি", "নিঃ", "উ", "উপ", "অভি"]
BANGLA_SUFFIXES = ["তা", "ত্ব", "তি", "গুলি", "গুলো", "ের", "র", "তে", "য়", "তে", "থেকে", "দের", "কে"]


def correct_bangla_ocr(text: str, confidence: float = 0.0) -> tuple[str, list[dict]]:
    """Correct common Bangla OCR errors in text.

    Args:
        text: OCR text that may contain Bangla character errors
        confidence: Average confidence of the OCR result (0-100)

    Returns:
        Tuple of (corrected_text, corrections) where corrections is a list of
        {original, corrected, position, type} dicts.
    """
    if not text or not text.strip():
        return text, []

    corrections: list[dict] = []
    corrected = text

    # 1. Fix broken matra (horizontal line) — sometimes OCR splits words at matra
    corrected, matra_fixes = _fix_matra_issues(corrected)
    corrections.extend(matra_fixes)

    # 2. Fix character confusions using context
    corrected, char_fixes = _fix_character_confusions(corrected, confidence)
    corrections.extend(char_fixes)

    # 3. Fix digit confusion (Bangla ↔ English)
    corrected, digit_fixes = _fix_digit_confusion(corrected)
    corrections.extend(digit_fixes)

    # 4. Fix spacing issues around Bangla punctuation
    corrected, spacing_fixes = _fix_bangla_spacing(corrected)
    corrections.extend(spacing_fixes)

    # 5. Fix common word patterns
    corrected, word_fixes = _fix_common_words(corrected)
    corrections.extend(word_fixes)

    # 6. Fix broken conjuncts (যুক্তাক্ষর)
    corrected, conjunct_fixes = _fix_conjuncts(corrected)
    corrections.extend(conjunct_fixes)

    # 7. Fix hasant (্) placement issues
    corrected, hasant_fixes = _fix_hasant(corrected)
    corrections.extend(hasant_fixes)

    return corrected, corrections


def _fix_matra_issues(text: str) -> tuple[str, list[dict]]:
    """Fix issues with Bangla matra (horizontal connecting line)."""
    fixes: list[dict] = []
    corrected = text

    # Fix: words split by matra — "বাং লা" → "বাংলা"
    # Pattern: Bangla char + space + Bangla char (likely split by matra)
    pattern = r"([\u0980-\u09FF])\s+([\u0980-\u09FF])"
    matches = list(re.finditer(pattern, corrected))
    # Apply in reverse to maintain positions
    for match in reversed(matches):
        # Only merge if the combined word looks more valid
        merged = match.group(1) + match.group(2)
        # Check if merged form is a common word substring
        if _is_likely_bangla_word_part(merged):
            pos = match.start()
            corrected = corrected[:pos] + merged + corrected[match.end():]
            fixes.append({
                "original": match.group(0),
                "corrected": merged,
                "position": pos,
                "type": "matra_merge",
            })

    return corrected, fixes


def _fix_character_confusions(text: str, confidence: float) -> tuple[str, list[dict]]:
    """Fix character confusions based on context and confidence."""
    fixes: list[dict] = []
    corrected = list(text)

    # Only apply character fixes if confidence is moderate (not too high = trust OCR)
    # or too low (too noisy to fix)
    should_fix = 30 < confidence < 85

    for i, char in enumerate(corrected):
        if char in CHAR_CONFUSIONS and should_fix:
            alternatives = CHAR_CONFUSIONS[char]
            if len(alternatives) > 1:
                # Get context (surrounding characters)
                prev_char = corrected[i - 1] if i > 0 else ""
                next_char = corrected[i + 1] if i < len(corrected) - 1 else ""

                # Try each alternative and check if it forms a better word
                best_alt = char
                best_score = _char_context_score(char, prev_char, next_char)

                for alt in alternatives:
                    if alt == char:
                        continue
                    score = _char_context_score(alt, prev_char, next_char)
                    if score > best_score:
                        best_score = score
                        best_alt = alt

                if best_alt != char:
                    corrected[i] = best_alt
                    fixes.append({
                        "original": char,
                        "corrected": best_alt,
                        "position": i,
                        "type": "char_confusion",
                    })

    return "".join(corrected), fixes


def _fix_digit_confusion(text: str) -> tuple[str, list[dict]]:
    """Fix digit confusion between Bangla and English numerals.

    Strategy: If the surrounding text is Bangla, convert English digits to Bangla.
    If surrounding text is English, convert Bangla digits to English.
    """
    fixes: list[dict] = []
    corrected = text

    # Find all digit sequences
    digit_pattern = r"[0-9\u09E6-\u09EF]+"
    matches = list(re.finditer(digit_pattern, corrected))

    for match in reversed(matches):
        digit_seq = match.group(0)
        pos = match.start()

        # Check surrounding context (20 chars before and after)
        context_start = max(0, pos - 20)
        context_end = min(len(corrected), match.end() + 20)
        context = corrected[context_start:context_end]

        # Count Bangla vs English chars in context
        bangla_chars = len(re.findall(r"[\u0980-\u09FF]", context))
        english_chars = len(re.findall(r"[a-zA-Z]", context))

        if bangla_chars > english_chars * 2:
            # Bangla context — convert English digits to Bangla
            converted = digit_seq
            for en, bn in EN_TO_BANGLA_DIGIT.items():
                converted = converted.replace(en, bn)
            if converted != digit_seq:
                corrected = corrected[:pos] + converted + corrected[match.end():]
                fixes.append({
                    "original": digit_seq,
                    "corrected": converted,
                    "position": pos,
                    "type": "digit_to_bangla",
                })
        elif english_chars > bangla_chars * 2:
            # English context — convert Bangla digits to English
            converted = digit_seq
            for bn, en in BANGLA_TO_EN_DIGIT.items():
                converted = converted.replace(bn, en)
            if converted != digit_seq:
                corrected = corrected[:pos] + converted + corrected[match.end():]
                fixes.append({
                    "original": digit_seq,
                    "corrected": converted,
                    "position": pos,
                    "type": "digit_to_english",
                })

    return corrected, fixes


def _fix_bangla_spacing(text: str) -> tuple[str, list[dict]]:
    """Fix spacing issues around Bangla punctuation and danda."""
    fixes: list[dict] = []
    corrected = text

    # Fix: space before danda (।) — "word ।" → "word।"
    pattern = r"\s+([।॥])"
    matches = list(re.finditer(pattern, corrected))
    for match in reversed(matches):
        pos = match.start()
        corrected = corrected[:pos] + match.group(1) + corrected[match.end():]
        fixes.append({
            "original": match.group(0),
            "corrected": match.group(1),
            "position": pos,
            "type": "spacing_danda",
        })

    # Fix: no space after danda — "word।word" → "word। word"
    pattern = r"([।॥])([^\s\d।॥])"
    matches = list(re.finditer(pattern, corrected))
    for match in reversed(matches):
        pos = match.start()
        replacement = match.group(1) + " " + match.group(2)
        corrected = corrected[:pos] + replacement + corrected[match.end():]
        fixes.append({
            "original": match.group(0),
            "corrected": replacement,
            "position": pos,
            "type": "spacing_after_danda",
        })

    # Fix: multiple spaces between Bangla words
    pattern = r"([\u0980-\u09FF])\s{2,}([\u0980-\u09FF])"
    matches = list(re.finditer(pattern, corrected))
    for match in reversed(matches):
        pos = match.start()
        replacement = match.group(1) + " " + match.group(2)
        corrected = corrected[:pos] + replacement + corrected[match.end():]
        fixes.append({
            "original": match.group(0),
            "corrected": replacement,
            "position": pos,
            "type": "spacing_multiple",
        })

    return corrected, fixes


def _fix_common_words(text: str) -> tuple[str, list[dict]]:
    """Fix common Bangla word OCR errors using dictionary matching."""
    fixes: list[dict] = []
    corrected = text

    # Find Bangla word tokens
    word_pattern = r"[\u0980-\u09FF]+"
    matches = list(re.finditer(word_pattern, corrected))

    for match in reversed(matches):
        word = match.group(0)
        pos = match.start()

        if word in COMMON_BANGLA_WORDS:
            continue  # Already correct

        # Try to find closest match in dictionary
        closest = _find_closest_word(word)
        if closest and closest != word:
            corrected = corrected[:pos] + closest + corrected[match.end():]
            fixes.append({
                "original": word,
                "corrected": closest,
                "position": pos,
                "type": "word_dictionary",
            })

    return corrected, fixes


def _fix_conjuncts(text: str) -> tuple[str, list[dict]]:
    """Fix broken conjuncts (যুক্তাক্ষর) — sometimes OCR splits them."""
    fixes: list[dict] = []
    corrected = text

    # Common broken conjuncts: hasant + consonant should form a conjunct
    # Example: "ক্" + "ত" → "ক্ত" (this is actually correct Unicode, but
    # sometimes OCR produces the wrong order)

    # Fix: consonant + hasant at end of word (likely broken conjunct)
    pattern = r"([\u0995-\u09B9\u09DC-\u09DF])\u09CD$"
    matches = list(re.finditer(pattern, corrected, re.MULTILINE))
    for match in reversed(matches):
        # Trailing hasant at end of line is likely a broken conjunct
        # Remove it as it's probably an OCR artifact
        pos = match.start()
        corrected = corrected[:pos] + match.group(1) + corrected[match.end():]
        fixes.append({
            "original": match.group(0),
            "corrected": match.group(1),
            "position": pos,
            "type": "conjunct_trailing_hasant",
        })

    return corrected, fixes


def _fix_hasant(text: str) -> tuple[str, list[dict]]:
    """Fix hasant (virama ্) placement issues."""
    fixes: list[dict] = []
    corrected = text

    # Fix: double hasant — "ক্্ত" → "ক্ত"
    pattern = r"\u09CD{2,}"
    matches = list(re.finditer(pattern, corrected))
    for match in reversed(matches):
        pos = match.start()
        corrected = corrected[:pos] + "\u09CD" + corrected[match.end():]
        fixes.append({
            "original": match.group(0),
            "corrected": "\u09CD",
            "position": pos,
            "type": "hasant_double",
        })

    # Fix: hasant before vowel sign (shouldn't happen)
    pattern = r"\u09CD([\u09BE-\u09CC\u0981-\u0983])"
    matches = list(re.finditer(pattern, corrected))
    for match in reversed(matches):
        pos = match.start()
        corrected = corrected[:pos] + match.group(1) + corrected[match.end():]
        fixes.append({
            "original": match.group(0),
            "corrected": match.group(1),
            "position": pos,
            "type": "hasant_before_vowel",
        })

    return corrected, fixes


def _is_likely_bangla_word_part(s: str) -> bool:
    """Check if a string looks like a valid Bangla word part."""
    if not s or len(s) < 2:
        return False
    # Must have at least one consonant
    if not re.search(r"[\u0995-\u09B9\u09DC-\u09DF]", s):
        return False
    # Check if it's a substring of any common word
    for word in COMMON_BANGLA_WORDS:
        if s in word:
            return True
    # Check if it follows Bangla word patterns (consonant + vowel signs)
    if re.match(r"^[\u0995-\u09B9\u09DC-\u09DF][\u09BE-\u09CC\u0981-\u0983\u09CD]?[\u0995-\u09B9\u09DC-\u09DF]?", s):
        return True
    return False


def _char_context_score(char: str, prev: str, next: str) -> float:
    """Score how likely a character is in its context."""
    score = 0.0

    # Base score for valid Bangla
    if char in COMMON_BANGLA_WORDS:
        score += 0.5

    # Check if prev+char+next forms part of a common word
    trigram = (prev + char + next).strip()
    if trigram:
        for word in COMMON_BANGLA_WORDS:
            if trigram in word:
                score += 1.0
                break
            # Check bigram
            if len(trigram) >= 2:
                for i in range(len(trigram) - 1):
                    if trigram[i:i+2] in word:
                        score += 0.3

    return score


def _find_closest_word(word: str, max_distance: int = 2) -> str | None:
    """Find closest match in dictionary using edit distance."""
    if not word or len(word) < 2:
        return None

    best_match = None
    best_distance = max_distance + 1

    for dict_word in COMMON_BANGLA_WORDS:
        if abs(len(dict_word) - len(word)) > max_distance:
            continue
        dist = _edit_distance(word, dict_word)
        if dist < best_distance:
            best_distance = dist
            best_match = dict_word

    return best_match if best_distance <= max_distance else None


def _edit_distance(s1: str, s2: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    m, n = len(s1), len(s2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[i - 1] == s2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(
                    dp[i - 1][j],
                    dp[i][j - 1],
                    dp[i - 1][j - 1],
                )

    return dp[m][n]


def correct_ocr_words(words: list[dict]) -> tuple[list[dict], list[dict]]:
    """Apply Bangla correction to OCR words.

    Args:
        words: List of word dicts with text, confidence, etc.

    Returns:
        Tuple of (corrected_words, all_corrections)
    """
    all_corrections: list[dict] = []

    for word in words:
        text = word.get("text", "")
        conf = word.get("confidence", 0)

        if not text:
            continue

        corrected_text, corrections = correct_bangla_ocr(text, conf)

        if corrections:
            word["text"] = corrected_text
            word["originalText"] = text
            word["corrections"] = corrections
            all_corrections.extend(corrections)

    return words, all_corrections


def compute_ocr_quality_score(words: list[dict], corrections: list[dict]) -> dict:
    """Compute overall OCR quality score for a page.

    Returns:
        {score, grade, lowConfidenceWords, totalWords, avgConfidence, correctionCount}
    """
    if not words:
        return {"score": 0, "grade": "F", "lowConfidenceWords": 0, "totalWords": 0,
                "avgConfidence": 0, "correctionCount": 0}

    total = len(words)
    confidences = [w.get("confidence", 0) for w in words]
    avg_conf = sum(confidences) / total

    low_conf = sum(1 for c in confidences if c < 60)
    medium_conf = sum(1 for c in confidences if 60 <= c < 80)
    high_conf = sum(1 for c in confidences if c >= 80)

    # Quality score: weighted combination
    # - Average confidence (50%)
    # - High confidence word ratio (30%)
    # - Correction count penalty (20%)
    high_ratio = high_conf / total
    correction_penalty = min(len(corrections) / total, 0.5)

    score = (avg_conf * 0.5) + (high_ratio * 100 * 0.3) - (correction_penalty * 100 * 0.2)
    score = max(0, min(100, score))

    # Grade
    if score >= 90:
        grade = "A+"
    elif score >= 80:
        grade = "A"
    elif score >= 70:
        grade = "B"
    elif score >= 60:
        grade = "C"
    elif score >= 50:
        grade = "D"
    else:
        grade = "F"

    return {
        "score": round(score, 1),
        "grade": grade,
        "lowConfidenceWords": low_conf,
        "mediumConfidenceWords": medium_conf,
        "highConfidenceWords": high_conf,
        "totalWords": total,
        "avgConfidence": round(avg_conf, 1),
        "correctionCount": len(corrections),
    }
