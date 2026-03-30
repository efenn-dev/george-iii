# Meme Downloader

Downloads GIFs or short video clips and converts them into overlay-ready MP4 files for the Minecraft meme library.

## Install

```bash
pip install -r requirements.txt
```

Make sure `ffmpeg` is installed and available in `PATH`.

## Single download

```bash
python download_meme.py "https://giphy.com/gifs/some-gif-id"
python download_meme.py "https://giphy.com/gifs/some-gif-id" --category funny
python download_meme.py "https://media.giphy.com/media/xxxxx/giphy.gif" --category death --name wasted
```

If `--category` is omitted, the script will prompt you.

## Batch download

Create a text file with one URL per line:

```text
https://media.giphy.com/media/xxxxx/giphy.gif
https://example.com/clip.mp4
```

Then run:

```bash
python batch_download.py urls.txt --category funny
```

## Output

Converted files are saved to:

- `assets/memes/clips/death/`
- `assets/memes/clips/victory/`
- `assets/memes/clips/surprise/`
- `assets/memes/clips/funny/`
- `assets/memes/clips/hype/`
- `assets/memes/clips/reactions/`

## Notes

- Output is MP4, scaled to a max width of 720px.
- Duration is capped at 10 seconds.
- GIFs and WebM files are converted with `ffmpeg`.
- Errors are reported cleanly for bad URLs, network problems, or `ffmpeg` failures.
