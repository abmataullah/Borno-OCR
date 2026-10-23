FROM libreoffice/unoserver:latest

# Install Noto fonts for major South Asian + popular scripts (all SIL OFL)
# fonts-noto-core covers: Devanagari (Hindi/Marathi/Nepali), Sinhala, Tamil,
# Telugu, Gujarati, Gurmukhi (Punjabi), Kannada, Malayalam, Arabic (Urdu), Thai
# fonts-noto-cjk covers: Chinese, Japanese, Korean
# fonts-noto adds serif variants for all scripts
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto-core \
    fonts-noto-cjk \
    fonts-noto \
    && rm -rf /var/lib/apt/lists/*

# Copy custom Bengali fonts
COPY fonts/ /usr/share/fonts/truetype/docflow-bengali/
RUN fc-cache -f

EXPOSE 2003 2004

CMD ["unoserver", "--port", "2003", "--convert-port", "2004", "--host", "0.0.0.0"]
