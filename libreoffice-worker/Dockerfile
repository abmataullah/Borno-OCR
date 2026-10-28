FROM libreofficedocker/libreoffice-unoserver:3.24

# Install Noto fonts for major South Asian + popular scripts (all SIL OFL)
# fonts-noto-core covers: Devanagari (Hindi/Marathi/Nepali), Sinhala, Tamil,
# Telugu, Gujarati, Gurmukhi (Punjabi), Kannada, Malayalam, Arabic (Urdu), Thai
# fonts-noto-cjk covers: Chinese, Japanese, Korean
# fonts-noto adds serif variants for all scripts
RUN apk add --no-cache font-noto font-noto-cjk font-noto-extra

# Copy custom Bengali fonts
COPY fonts/ /usr/share/fonts/truetype/docflow-bengali/
RUN fc-cache -f

EXPOSE 2003 2004

CMD ["unoserver", "--interface", "0.0.0.0", "--port", "2003"]
