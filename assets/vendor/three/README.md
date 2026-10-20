# three.js (yerel kopya)

Sürüm: three@0.186.1 (MIT, bkz. `LICENSE`). 3D oyunlar CDN yerine bu dosyayı göreli yolla içe aktarır:

```js
import * as THREE from '../../assets/vendor/three/three.module.min.js';
```

npm paketindeki `build/three.module.js` (+ `three.core.js`) tek dosyada birleştirilip küçültüldü:

```sh
npm pack three@0.186.1 && tar xzf three-0.186.1.tgz
npx esbuild@0.25.10 package/build/three.module.js --bundle --format=esm --minify --legal-comments=inline --outfile=three.module.min.js
```

Bu dosyayı kullanan oyun, yolu `games.json`'daki `dosyalar` listesine eklemelidir; böylece çevrimdışı önbelleğe girer.
