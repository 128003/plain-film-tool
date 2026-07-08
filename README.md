# Plain Film 判讀量測工具

純前端、單機可用的 X 光片(plain film)判讀輔助工具,涵蓋 8 個部位、41 項量測:

頸椎 Cervical Spine・腰椎 Lumbar Spine・薦椎/骨盆 Sacrum & Pelvic Ring・肩關節 Shoulder・髖關節 Hip・膝關節 Knee・踝關節 Ankle・足部 Foot

**線上版本:** https://128003.github.io/plain-film-tool/

## 功能

- 上傳 X 光影像(JPG/PNG),在圖片上點選標記點,依部位/量測項目自動計算角度、比值、距離或滑脫百分比
- 依文獻正常值/異常切點即時判讀(綠=正常、紅=異常、黃=邊緣性、灰=參考)
- 比例尺校正(pixel ↔ mm),未校正時距離類量測仍可操作並顯示像素值
- 目視判讀項目(Shenton's line、Klein's line 等)與 Kellgren-Lawrence 分級可不上傳影像直接勾選練習
- 同部位所有量測結果彙整於下方表格
- 所有計算皆在瀏覽器本機完成,影像不上傳任何伺服器

## 檔案結構

| 檔案 | 說明 |
|---|---|
| `index.html` / `style.css` / `app.js` | 網站本體(無建置工具,雙擊 index.html 即可離線使用) |
| `plain_film_data.json` | **唯一資料來源**:8 部位 41 項量測的完整定義與文獻來源 |
| `data.js` | 由 JSON 自動產生供瀏覽器離線載入,請勿手動編輯 |

修改量測資料時請編輯 `plain_film_data.json`,再重新產生 `data.js`:

```bash
python3 -c "
raw = open('plain_film_data.json').read()
open('data.js','w').write('// 由 plain_film_data.json 自動產生,請勿手動編輯;修改資料請改 JSON 後重新產生\nwindow.PLAIN_FILM_DATA = ' + raw.strip() + ';\n')
"
```

## 部署(GitHub Pages)

Repo → Settings → Pages → Source: Deploy from a branch → Branch: `main` / `/ (root)` → Save,約 1-3 分鐘生效。

## 免責聲明

⚠️ 本工具僅供教學與判讀輔助參考,不取代專科醫師之最終診斷。
