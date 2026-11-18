# SafiSense Dashboard Manual

*What this website does, and how to use it. Written for the AquaCode web development track.*

---

## 1. What is SafiSense?

SafiSense is a small website that watches the quality of water and tells you, in one glance, whether the water looks **SAFE** or **UNSAFE** to drink.

It works like this:

1. Sensors (or a built-in simulation) measure the water every 2 seconds.
2. The website reads those numbers.
3. It checks them against a simple safety rule.
4. It shows you the result as coloured cards, a live graph, and a big green or red badge.

**The safety rule** (the most important sentence in this manual):

> Water is **SAFE** when pH is between **6.5 and 8.5** AND the cleaned water's TDS is **500 ppm or less**. Otherwise it is **UNSAFE**.

If either check fails, the water is marked unsafe. Both checks must pass.

---

## 2. The words you need (glossary)

| Word | Simple meaning |
|---|---|
| **pH** | How acidic or basic the water is. 7 is neutral. Below 7 is acidic (like lemon juice), above 7 is basic (like soap water). Drinking water should be 6.5 to 8.5. |
| **TDS** | "Total Dissolved Solids". The amount of stuff dissolved in the water (salts, minerals). Measured in **ppm** (parts per million). Higher TDS = "heavier" water. 500 ppm is the guideline limit for drinking water. |
| **TDS in** | The TDS of the **source water** before cleaning (the dirty/salty side). |
| **TDS out** | The TDS of the water **after** cleaning (the output side). This is the one that must be under 500 ppm. |
| **Removal %** | How much TDS the cleaning process removed. Formula: (TDS in − TDS out) ÷ TDS in × 100. |
| **Turbidity** | How cloudy the water is, in NTU. Cloudy water can hide germs. |
| **Reading** | One set of sensor values taken at one moment. |

---

## 3. The screen, part by part

### A. The header and the big badge (top right)

The **coloured pill** next to the title is the verdict:

- **SAFE (green)** — the rule passed.
- **UNSAFE (red)** — the rule failed.
- **— (grey)** — not started yet.

In **Server mode** you may also see a second small badge starting with **ML:**. That is a machine-learning model giving its own second opinion, with a confidence percentage. The coloured rule badge is always the boss; the ML badge is a helper.

### B. The control card

| Control | What it does |
|---|---|
| **Data source** | Choose where the numbers come from. Three options, explained in section 4. |
| **Address box** | Only appears for live modes. This is where the device or server address goes. |
| **Start** | Begins taking a reading every 2 seconds. |
| **Stop** | Pauses the readings. |
| **Export CSV** | Downloads every reading so far as a spreadsheet file (`safisense_readings.csv`). |
| **Clear** | Wipes the memory: chart and counter go back to zero. |
| **Status line** | The small grey text under the buttons. It always says what is happening (how many readings, the time of the last one, or what went wrong). |

### C. The six tiles

Each tile shows one number from the latest reading:

| Tile | Turns red when… |
|---|---|
| **pH** | value is below 6.5 or above 8.5 |
| **TDS in** | never (it is the input, it is allowed to be dirty) |
| **TDS out** | value is above 500 ppm |
| **Temp** | never (measured for information) |
| **Turbidity** | never (measured for information) |
| **Removal** | value is below 80% |

### D. The live chart

The graph shows the history of the last 150 readings.

- **Blue line** = TDS in (dirty side)
- **Teal line** = TDS out (cleaned side)
- **Red dashed line** = the 500 ppm limit

The two lines should be far apart: a big gap means the cleaning is working well. When the teal line jumps close to or over the red dashed line, the water is becoming unsafe. You will see the badge flip to red at the same moment.

### E. Telegram alerts (hidden section at the bottom)

Optional. If you put in a bot token and chat ID and send a test message, the site will send a Telegram message every time the status changes from SAFE to UNSAFE. The token is stored only in your own browser. This needs internet.

---

## 4. The three data sources

Pick one in the **Data source** dropdown:

### 1. Simulated (demo mode)

No sensors, no Wi-Fi, nothing to plug in. The website invents realistic water readings by itself: it wanders up and down, sometimes spikes the TDS, sometimes drifts the pH out of range, so the badge flips between green and red on its own.

**Use this** for practice, for testing, or whenever the hardware is not around.

### 2. ESP32 (live)

Reads from the real water-quality station. The ESP32 (a small internet-connected chip) creates its own Wi-Fi network and shares the readings as text (JSON) at the address `/data`. The website fetches that address every 2 seconds.

To use it:

1. Connect your device to the ESP32's Wi-Fi network.
2. Choose **ESP32 (live)**.
3. Leave the address as `http://192.168.4.1` (or type the right one).
4. Press **Start**.

### 3. Server (live + ML)

Reads from the FastAPI server. The server stores readings, runs the machine-learning model, and adds its verdict to the data. The website fetches `/api/latest` every 2 seconds.

To use it:

1. Make sure the server is running (for local testing the address `http://localhost:8000` already works).
2. Choose **Server (live + ML)**.
3. Press **Start**.

**Troubleshooting tip:** the status line tells you exactly what failed. "Cannot reach…" means check the address, the Wi-Fi, or whether the device or server is switched on.

---

## 5. Ten-minute practice routine

1. Choose **Simulated (demo mode)** and press **Start**.
2. Watch the six tiles for a few seconds. Which one changes the fastest?
3. Watch the chart. Find the red dashed line. Does the teal (cleaned) line usually stay below it?
4. When the badge goes red, look at the tiles: is it the pH tile or the TDS out tile that turned red? That tells you *which* rule failed.
5. Press **Export CSV** and open the file in a spreadsheet. Each row is one reading, with a `safe` column of 1s and 0s.
6. Press **Clear** to start fresh.

---

## 6. Under the hood (bonus slide, if the group asks)

- The whole page is built with plain **HTML, CSS and JavaScript**, no external libraries. The chart is drawn by hand on an HTML `<canvas>` element, one line segment per reading.
- A JavaScript timer calls a function called `tick()` every 2 seconds. `tick()` gets one reading, applies the safety rule, and updates the tiles, the badge and the chart.
- The CSV export builds a text string in CSV format and triggers a download with a `Blob` and `URL.createObjectURL`.
- The complete rule is one line of code: `safe = (ph >= 6.5 && ph <= 8.5 && tds_out <= 500)`.