# Robinson dashcam upload: a shot register

The El Reno footage register holds seven clock samples from Dan Robinson's full dashcam upload, [`MxgU1QcFMJM`](https://www.youtube.com/watch?v=MxgU1QcFMJM), a player duration of 868.161 s. Each sample is a paused frame. Nothing said what lies between them. This record reads the whole upload for its edit: every cut and transition, which camera each stretch shows, the captions laid over it, and the clock at both ends of every stretch that runs without a break. The machine readable register is [`robinson-shot-register-2026-11-16.json`](robinson-shot-register-2026-11-16.json), and `validate_shot_register` in `atlas/footage.py` checks it.

The upload is four uninterrupted passages joined by five transitions. Each passage has a read clock at both ends, and no cut was found inside one. All seven published samples read the same clock again on the reference copy. The register also shows something the samples could not: the caption clock that every sample reads changes its basis during the upload. Against the forward camera's own date and time stamp, the caption sits 273 s behind in the first forward passage, 229 to 230 s behind after the cut at 628.394 s, and 219 s behind after a caption step at 646.346 s. The step at 646.346 s happens inside one continuous camera passage. The two later samples, `robinson-06` and `robinson-07`, lie after both changes.

## The second source video

The roadmap asks for both source videos. The second is the El Reno Survey's aligned edit of the same Robinson footage, Vimeo `145291664`. On 2026-11-16 at 22:29:35 UTC its oEmbed request returned HTTP 404 and its player returned the same unavailable message as the Marshall player, while the same two requests for a public Vimeo video answered normally. The [Marshall decision](marshall-qualification-2026-11-16.md) records those requests and the control. This record therefore registers the YouTube upload alone. No position or offset from one upload is carried to the other.

## The reference copy

Reading every frame needs a local copy. One was made with `yt-dlp` and `ffmpeg` and kept privately for this review. It is not committed, hosted or published, and no frame from it is republished.

| Property | Value |
| --- | --- |
| Formats | `616+140` |
| Video | VP9, 1920x1080, 30000/1001 frames per second, 26,017 frames, stream duration 868.100 s |
| Audio | AAC, stream duration 868.194104 s |
| Size | 366,105,439 bytes |
| SHA-256 | `2f317aafc5db7caee57ad7497838001c739c74e08e5315669340770810aecb6d` |
| Retrieved | 2026-11-16, 22:44:32 to 22:44:55 UTC |

The video stream ends 0.061 s short of the player duration, so a position here is a player position to within a frame or two. Every position below is the presentation time of one decoded frame. Each was decoded as the first frame at or after the requested time.

## How the frames were read

1. The ffmpeg scene filter scored every frame. Six frames scored high: 9.043, 9.076, 9.110, 17.818, 68.001 and 628.394 s. The first five are brief changes of light across the whole picture while the clock runs on, not a change of shot. Only 628.394 s is a cut.
2. Tesseract read the caption clock at the lower left on every 15th frame, 1,735 samples in all. Wherever the clock minus the player position jumped between adjacent samples instead of drifting with the rate, and wherever no clock was read, the frames were viewed on contact sheets. Every apparent change outside the boundaries below was an OCR misreading, such as a 1 read as 7 or an 8 read as 6, and the frames show the clock running on.
3. The rear camera prints a yellow stamp at the top left. Counting yellow pixels there on the same samples splits the upload into forward, rear and forward stretches, which the contact sheets confirm.
4. Inside each passage a line was fitted to the clock against the player position, and the largest step between the averages of 16 samples on either side of any point was 0.42, 0.40 and 0.35 s in the three long passages. That average cannot be taken in the first and last eight seconds of a passage. There the end labels still fit the measured rate within one second.
5. A contact sheet of every 120th frame covers the whole upload, and a detector for the caption box ran on every 15th frame. Neither shows a reuse credit, a title card or an end card, though a credit shorter than four seconds outside the caption box could fall between the sampled frames. The only lasting overlays are the clock and the StormHighway.com logo at the bottom.
6. At each boundary every frame was decoded with its presentation time and read by eye. The dissolve was measured by fitting each frame as a mixture of the last forward and first rear pictures, and the fades by mean brightness.
7. The forward and rear stamps were read by eye on enlarged crops at fifteen positions, each beside the caption on the same frame.
8. The inset's edges were read by eye on frames half a second apart, from 636.6 to 640.1 s and from 748.8 to 760.3 s.

Positions are the container's own presentation times, stored in units of 1/16000 s and written here to the millisecond.

## Passages

| Passage | Camera | Start (s) | Clock | End (s) | Clock | Player time (s) | Clock time (s) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `forward-1` | forward | 2.002 | 6:17:00 PM CDT | 353.120 | 6:22:45 PM CDT | 351.118 | 345 |
| `rear-1` | rear | 354.555 | 6:22:46 PM CDT | 628.361 | 6:27:15 PM CDT | 273.806 | 269 |
| `forward-2` | forward | 628.394 | 6:26:32 PM CDT | 646.312 | 6:26:49 PM CDT | 17.918 | 17 |
| `forward-3` | forward | 646.346 | 6:27:00 PM CDT | 867.066 | 6:30:36 PM CDT | 220.720 | 216 |

The clock advances about 0.98 s for every second of playback. Fitted over the OCR samples, the three long passages give 0.98228, 0.98251 and 0.98312, and the forward stamp gives 0.9826 over `forward-1`. The register uses 0.9826 with a tolerance of 0.002, and the validator refuses a passage whose clock time strays from that rate by more than one second plus 0.002 s for every second of playback. Playback therefore runs about 1.8 percent longer than the clock. The notes on the later published samples already say that elapsed video time is not assumed to equal elapsed storm time.

## Transitions

Each transition runs from the last frame of the passage before it to the first frame of the passage after it. The opening fade starts on the first frame of the upload and the closing fade ends on the last, and both of those frames are black.

| Transition | Kind | From (s) | To (s) | What happens |
| --- | --- | --- | --- | --- |
| `opening-fade` | fade in | 0.000 | 2.002 | Fades from black. The dim clock reads 6:16:58 from 0.133 s and 6:16:59 from 0.634 s. |
| `switch-to-rear` | dissolve | 353.120 | 354.555 | Forward dissolves into rear under "Switch to rear-facing camera". Mixed frames run from 353.153 to 354.521 s. The caption reads 6:22:45 before and 6:22:46 after. |
| `cut-to-forward` | hard cut | 628.361 | 628.394 | Rear at 6:27:15 cuts to forward at 6:26:32. The caption clock steps back 43 s. |
| `caption-step` | caption jump | 646.312 | 646.346 | The caption steps from 6:26:49 to 6:27:00 between consecutive frames. The picture runs on and the forward stamp reads 18:30:39 on both sides. |
| `closing-fade` | fade out | 867.066 | 868.067 | Fades to black from 867.100 s. The last legible label is 6:30:37 at 867.900 s. |

The dissolve presents the two cameras as simultaneous, because the caption runs straight through it. That pairing rests on the caption alone. The rear stamp is dated 2012/07/23, so it was never set for the event. The cut at 628.394 s returns to the forward camera 43 s of caption time earlier, so `forward-2` and the end of `rear-1` show the same caption times from two directions.

## The caption clock against the camera stamps

| Position (s) | Passage | Camera stamp | Caption | Stamp minus caption |
| --- | --- | --- | --- | --- |
| 5.005 | `forward-1` | `2013/05/31- 18:21:36` | 6:17:03 PM CDT | 273 s |
| 150.017 | `forward-1` | `2013/05/31- 18:23:58` | 6:19:25 PM CDT | 273 s |
| 300.000 | `forward-1` | `2013/05/31- 18:26:26` | 6:21:53 PM CDT | 273 s |
| 350.016 | `forward-1` | `2013/05/31- 18:27:15` | 6:22:42 PM CDT | 273 s |
| 360.027 | `rear-1` | `2012/07/23- 09:52:54` | 6:22:52 PM CDT | 15 h 30 min 2 s |
| 500.033 | `rear-1` | `2012/07/23- 09:55:12` | 6:25:09 PM CDT | 15 h 30 min 3 s |
| 620.019 | `rear-1` | `2012/07/23- 09:57:10` | 6:27:07 PM CDT | 15 h 30 min 3 s |
| 629.528 | `forward-2` | `2013/05/31- 18:30:22` | 6:26:33 PM CDT | 229 s |
| 640.006 | `forward-2` | `2013/05/31- 18:30:32` | 6:26:43 PM CDT | 229 s |
| 646.012 | `forward-2` | `2013/05/31- 18:30:38` | 6:26:49 PM CDT | 229 s |
| 646.312 | `forward-2` | `2013/05/31- 18:30:39` | 6:26:49 PM CDT | 230 s |
| 646.513 | `forward-3` | `2013/05/31- 18:30:39` | 6:27:00 PM CDT | 219 s |
| 646.813 | `forward-3` | `2013/05/31- 18:30:39` | 6:27:00 PM CDT | 219 s |
| 700.000 | `forward-3` | `2013/05/31- 18:31:31` | 6:27:52 PM CDT | 219 s |
| 860.026 | `forward-3` | `2013/05/31- 18:34:09` | 6:30:30 PM CDT | 219 s |

Both labels are whole seconds, so a constant offset can show as two adjacent values. Inside each passage the offset holds within that second. Between passages it does not.

The caption step at 646.346 s is the firm case. The forward picture continues without a cut, the stamp shows the same second on both sides, and the caption jumps 11 s. The caption's basis changes there by 10 or 11 s, so the caption cannot be right on both sides of it.

The change at the cut rests on one assumption. If the same forward camera, keeping one clock, recorded both `forward-1` and `forward-2`, the caption basis moved 44 s at 628.394 s, and over the whole upload the three forward passages use bases up to 54 s apart. The two passages carry stamps of the same style in the same place. The assumption fails if a second forward camera recorded `forward-2`, or if the camera's clock was reset between the two recordings. This record does not test either.

The creator describes the printed CDT clock as GPS synchronized. That is the creator's claim, and the footage register keeps it attributed. This review cannot say which of the three bases matches the true time. Settling it needs an independent reference, such as the creator's GPS log, a radar scan time matched to an event visible in the footage, or another source with a checked clock.

## The published samples

| Sample | Published position (s) | Frame read (s) | Caption | Passage |
| --- | --- | --- | --- | --- |
| `robinson-01` | 5 | 5.005 | 6:17:03 PM CDT | `forward-1` |
| `robinson-02` | 86.810056 | 86.821 | 6:18:23 PM CDT | `forward-1` |
| `robinson-03` | 260.430169 | 260.460 | 6:21:14 PM CDT | `forward-1` |
| `robinson-04` | 434.050283 | 434.067 | 6:24:04 PM CDT | `rear-1` |
| `robinson-05` | 607.670396 | 607.674 | 6:26:55 PM CDT | `rear-1` |
| `robinson-06` | 694.480453 | 694.494 | 6:27:47 PM CDT | `forward-3` |
| `robinson-07` | 781.290509 | 781.314 | 6:29:12 PM CDT | `forward-3` |

Each caption equals the published UTC minus five hours, and each sits on its passage's clock line within one second. Two things the published notes do not say follow from the register. `robinson-04` and `robinson-05` show the rear camera, looking back through the rear window. `robinson-06` and `robinson-07` read a caption whose basis differs from the one `robinson-01` to `robinson-03` read, by 54 s against the forward stamp. A registered interval built on these samples has to carry that difference until an independent reference settles it.

## Captions and the inset

A caption's edges are the first and last of every 15th frame on which the detector found its box. Captions fade in and out beyond those frames by up to about a second and a half. The first caption is still faint at 9.12 s, and the rear camera caption shows faintly from 353.287 s. The inset's edges are the first and last frames, half a second apart, on which it was seen, faint at both ends.

| From (s) | To (s) | Overlay |
| --- | --- | --- |
| 4.505 | 8.008 | "Southbound on S Choctaw (near Jensen)" |
| 56.556 | 62.563 | "Turning east on NW 10th/Reuter from S Choctaw" |
| 135.135 | 141.642 | "NW 10th/Reuter & Highway 81" |
| 228.228 | 231.731 | "NW 10th/Reuter & S Alfadale" |
| 311.811 | 316.817 | "NW 10th/Reuter & S Radio" |
| 354.855 | 358.359 | "Switch to rear-facing camera", fading in from about 353.29 s during the dissolve |
| 401.401 | 404.904 | "NW 10th/Reuter & S Evans" |
| 629.629 | 634.134 | "Front camera, starting before rear window blowout" |
| 639.105 | 752.819 | A third camera, inset at the lower right of the forward picture |
| 639.639 | 643.142 | "Driver side camera inset" |
| 705.705 | 706.706 | "Running for south ditch on Reuter Rd." |
| 720.220 | 723.222 | "Rear window blowout" |

The road names are the creator's labels. They are not map coordinates, and this record does not turn them into any. The inset camera has no clock of its own on screen, so nothing here says when its frames were recorded. A red glow along the lower edge of the rear picture at some positions is light in the scene, not text.

## What this record did not do

It did not review the audio. It did not place a camera, measure a bearing or match a view to a map, and it did not decide which caption basis is right. Between boundaries it read every 15th frame, so a splice that removed less than about a second inside a passage would not move the whole second labels enough to show. It did not inspect Vimeo `145291664`. It did not change `exhibits/el-reno-2013/footage.json`. The El Reno dossier pins that file's bytes among its reviewed inputs, so admitting these passages into the exhibit needs a new reviewed dossier version of its own.
