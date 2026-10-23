FROM collabora/code:latest

USER root

# Install Noto fonts for major South Asian + popular scripts (all SIL OFL)
# fonts-noto-core covers: Devanagari (Hindi/Marathi/Nepali), Sinhala, Tamil,
# Telugu, Gujarati, Gurmukhi (Punjabi), Kannada, Malayalam, Arabic (Urdu), Thai
# fonts-noto-cjk covers: Chinese, Japanese, Korean
# fonts-noto adds serif variants for all scripts
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto-core \
    fonts-noto-cjk \
    fonts-noto \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy custom Bangla fonts (Solaiman Lipi, Kalpurush, Siyam Rupali)
COPY fonts/ /usr/share/fonts/truetype/docflow-bangla/
RUN fc-cache -f

USER cool

# No CMD override — collabora/code has its own entrypoint
