// src/storage/kb-sqlite.ts
import { createHash } from "node:crypto";
import fs2 from "node:fs";
import os from "node:os";
import path3 from "node:path";
import { DatabaseSync } from "node:sqlite";

// src/core/cjk-tokenizer.ts
var CJK_CHAR_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
var CJK_RUN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/g;
var ASCII_TOKEN_RE = /[A-Za-z0-9_.-]{2,}/g;
function tokenizeForFts(text) {
  const tokens = [];
  const cjkRuns = text.match(CJK_RUN_RE) ?? [];
  for (const run of cjkRuns) {
    if (run.length === 1) {
      tokens.push(run);
    } else {
      for (let i2 = 0; i2 < run.length - 1; i2 += 1) {
        tokens.push(run.slice(i2, i2 + 2));
      }
    }
  }
  const asciiRuns = text.match(ASCII_TOKEN_RE) ?? [];
  for (const word of asciiRuns) {
    tokens.push(word.toLowerCase());
  }
  return tokens.join(" ");
}
function buildFtsTokenQuery(query) {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const terms = /* @__PURE__ */ new Set();
  const cjkRuns = trimmed.match(CJK_RUN_RE) ?? [];
  for (const run of cjkRuns) {
    if (run.length === 1) {
      terms.add(run);
    } else {
      for (let i2 = 0; i2 < run.length - 1; i2 += 1) {
        terms.add(run.slice(i2, i2 + 2));
      }
    }
  }
  const asciiRuns = trimmed.match(ASCII_TOKEN_RE) ?? [];
  for (const word of asciiRuns) {
    terms.add(word.toLowerCase());
  }
  if (terms.size === 0) return null;
  return [...terms].slice(0, 16).map((term) => `"${term.replaceAll('"', '""')}"`).join(" AND ");
}
function buildFtsTrigramQuery(query) {
  const trimmed = query.trim();
  if (trimmed.length < 3) return null;
  const safe = trimmed.replaceAll('"', '""').slice(0, 128);
  return `"${safe}"`;
}
function hasCjk(text) {
  return CJK_CHAR_RE.test(text);
}

// src/core/extractors.ts
import path from "node:path";

// node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/index.mjs
import { createRequire } from "module";
var require2 = createRequire("/");
var _a;
var Worker;
var isMarkedAsUntransferable;
try {
  _a = require2("worker_threads"), Worker = _a.Worker, isMarkedAsUntransferable = _a.isMarkedAsUntransferable;
} catch (e) {
}
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i2 = 0; i2 < 31; ++i2) {
    b[i2] = start += 1 << eb[i2 - 1];
  }
  var r = new i32(b[30]);
  for (var i2 = 1; i2 < 30; ++i2) {
    for (var j = b[i2]; j < b[i2 + 1]; ++j) {
      r[j] = j - b[i2] << 5 | i2;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = (function(cd, mb, r) {
  var s = cd.length;
  var i2 = 0;
  var l = new u16(mb);
  for (; i2 < s; ++i2) {
    if (cd[i2])
      ++l[cd[i2] - 1];
  }
  var le = new u16(mb);
  for (i2 = 1; i2 < mb; ++i2) {
    le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        var sv = i2 << 4 | cd[i2];
        var r_1 = mb - cd[i2];
        var v = le[cd[i2] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
      }
    }
  }
  return co;
});
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = function(a) {
  var m = a[0];
  for (var i2 = 1; i2 < a.length; ++i2) {
    if (a[i2] > m)
      m = a[i2];
  }
  return m;
};
var bits = function(d, p, m) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i2 = 0; i2 < hcLen; ++i2) {
          clt[clim[i2]] = bits(dat, pos + i2 * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i2 = 0; i2 < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i2++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i2 - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i2++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i2 = sym - 257, b = fleb[i2];
          add = bits(dat, pos, (1 << b) - 1) + fl[i2];
          pos += b;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var et = /* @__PURE__ */ new u8(0);
var b2 = function(d, b) {
  return d[b] | d[b + 1] << 8;
};
var b4 = function(d, b) {
  return (d[b] | d[b + 1] << 8 | d[b + 2] << 16 | d[b + 3] << 24) >>> 0;
};
var b8 = function(d, b) {
  return b4(d, b) + b4(d, b + 4) * 4294967296;
};
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}
var dutf8 = function(d) {
  for (var r = "", i2 = 0; ; ) {
    var c = d[i2++];
    var eb = (c > 127) + (c > 223) + (c > 239);
    if (i2 + eb > d.length)
      return { s: r, r: slc(d, i2 - 1) };
    if (!eb)
      r += String.fromCharCode(c);
    else if (eb == 3) {
      c = ((c & 15) << 18 | (d[i2++] & 63) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63) - 65536, r += String.fromCharCode(55296 | c >> 10, 56320 | c & 1023);
    } else if (eb & 1)
      r += String.fromCharCode((c & 31) << 6 | d[i2++] & 63);
    else
      r += String.fromCharCode((c & 15) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63);
  }
};
function strFromU8(dat, latin1) {
  if (latin1) {
    var r = "";
    for (var i2 = 0; i2 < dat.length; i2 += 16384)
      r += String.fromCharCode.apply(null, dat.subarray(i2, i2 + 16384));
    return r;
  } else if (td) {
    return td.decode(dat);
  } else {
    var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
    if (r.length)
      err(8);
    return s;
  }
}
var slzh = function(d, b) {
  return b + 30 + b2(d, b + 26) + b2(d, b + 28);
};
var zh = function(d, b, z) {
  var fnl = b2(d, b + 28), efl = b2(d, b + 30), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl;
  var _a2 = z64hs(d, es, efl, z, b4(d, b + 20), b4(d, b + 24), b4(d, b + 42)), sc = _a2[0], su = _a2[1], off = _a2[2];
  return [b2(d, b + 10), sc, su, fn, es + efl + b2(d, b + 32), off];
};
var z64hs = function(d, b, l, z, sc, su, off) {
  var nsc = sc == 4294967295, nsu = su == 4294967295, noff = off == 4294967295, e = b + l;
  var nf = nsc + nsu + noff;
  if (z && nf) {
    for (; b + 4 < e; b += 4 + b2(d, b + 2)) {
      if (b2(d, b) == 1) {
        return [
          nsc ? b8(d, b + 4 + 8 * nsu) : sc,
          nsu ? b8(d, b + 4) : su,
          noff ? b8(d, b + 4 + 8 * (nsu + nsc)) : off,
          1
        ];
      }
    }
    if (z < 2)
      err(13);
  }
  return [sc, su, off, 0];
};
function unzipSync(data, opts) {
  var files = {};
  var e = data.length - 22;
  for (; b4(data, e) != 101010256; --e) {
    if (!e || data.length - e > 65558)
      err(13);
  }
  ;
  var c = b2(data, e + 8);
  if (!c)
    return {};
  var o = b4(data, e + 16);
  var z = b4(data, e - 20) == 117853008;
  if (z) {
    var ze = b4(data, e - 12);
    z = b4(data, ze) == 101075792;
    if (z) {
      c = b4(data, ze + 32);
      o = b4(data, ze + 48);
    }
  }
  var fltr = opts && opts.filter;
  for (var i2 = 0; i2 < c; ++i2) {
    var _a2 = zh(data, o, z), c_2 = _a2[0], sc = _a2[1], su = _a2[2], fn = _a2[3], no = _a2[4], off = _a2[5], b = slzh(data, off);
    o = no;
    if (!fltr || fltr({
      name: fn,
      size: sc,
      originalSize: su,
      compression: c_2
    })) {
      if (!c_2)
        files[fn] = slc(data, b, b + sc);
      else if (c_2 == 8)
        files[fn] = inflateSync(data.subarray(b, b + sc), { out: new u8(su) });
      else
        err(14, "unknown compression type " + c_2);
    }
  }
  return files;
}

// src/core/ooxml-extract.ts
var DEFAULT_ZIP_QUOTAS = {
  maxEntries: 1e3,
  maxSingleFileBytes: 25 * 1024 * 1024,
  maxTotalBytes: 100 * 1024 * 1024,
  maxCompressionRatio: 100
};
var OLE2_MAGIC = Buffer.from([208, 207, 17, 224, 161, 177, 26, 225]);
var ZIP_MAGIC = Buffer.from([80, 75, 3, 4]);
var OoxmlBlockedError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "OoxmlBlockedError";
    this.code = code;
  }
};
function precheckZipCentralDirectory(buf, quotas = DEFAULT_ZIP_QUOTAS) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const minPos = Math.max(0, buf.byteLength - 65557);
  let eocdOffset = -1;
  for (let i2 = buf.byteLength - 22; i2 >= minPos; i2 -= 1) {
    if (view.getUint32(i2, true) === 101010256) {
      eocdOffset = i2;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new OoxmlBlockedError("INVALID_ZIP", "Missing ZIP End of Central Directory (EOCD)");
  }
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  if (totalEntries > quotas.maxEntries) {
    throw new OoxmlBlockedError("ZIP_BOMB_QUOTA", `ZIP entry count ${totalEntries} exceeds quota ${quotas.maxEntries}`);
  }
  const cdSize = view.getUint32(eocdOffset + 12, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  if (cdOffset + cdSize > buf.byteLength) {
    throw new OoxmlBlockedError("INVALID_ZIP", "Corrupt ZIP central directory bounds");
  }
  let pos = cdOffset;
  let totalUncompressed = 0;
  let seen = 0;
  while (pos < cdOffset + cdSize && seen < totalEntries) {
    if (pos + 46 > buf.byteLength || view.getUint32(pos, true) !== 33639248) {
      throw new OoxmlBlockedError("INVALID_ZIP", "Corrupt ZIP central directory entry header");
    }
    const compSize = view.getUint32(pos + 20, true);
    const uncompSize = view.getUint32(pos + 24, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const entryName = strFromU8(buf.subarray(pos + 46, pos + 46 + nameLen));
    if (entryName.startsWith("/") || entryName.startsWith("\\") || entryName.includes("..") || /^[A-Za-z]:/.test(entryName)) {
      throw new OoxmlBlockedError("INVALID_ZIP", `Unsafe ZIP entry path rejected: ${entryName}`);
    }
    if (uncompSize > quotas.maxSingleFileBytes) {
      throw new OoxmlBlockedError("ZIP_BOMB_QUOTA", `Entry "${entryName}" uncompressed size ${uncompSize} exceeds limit ${quotas.maxSingleFileBytes}`);
    }
    if (compSize > 0 && uncompSize / compSize > quotas.maxCompressionRatio && uncompSize > 512 * 1024) {
      throw new OoxmlBlockedError(
        "ZIP_BOMB_QUOTA",
        `Entry "${entryName}" compression ratio ${(uncompSize / compSize).toFixed(1)}x exceeds limit ${quotas.maxCompressionRatio}x`
      );
    }
    totalUncompressed += uncompSize;
    if (totalUncompressed > quotas.maxTotalBytes) {
      throw new OoxmlBlockedError("ZIP_BOMB_QUOTA", `Total uncompressed size ${totalUncompressed} exceeds quota ${quotas.maxTotalBytes}`);
    }
    pos += 46 + nameLen + extraLen + commentLen;
    seen += 1;
  }
}
function assertNoXxe(xml, partName) {
  if (/<!(?:DOCTYPE|ENTITY)\b/i.test(xml)) {
    throw new OoxmlBlockedError("XXE_FORBIDDEN", `XML DTD/ENTITY declarations forbidden in ${partName}`);
  }
}
function decodeXmlEntities(text) {
  return text.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&amp;", "&").replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16))).replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)));
}
function safeUnzipOoxml(input, quotas) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < 8) {
    throw new OoxmlBlockedError("INVALID_ZIP", "File too small to be a valid OOXML archive");
  }
  if (Buffer.from(bytes.subarray(0, 8)).equals(OLE2_MAGIC)) {
    throw new OoxmlBlockedError("LEGACY_OFFICE_FORMAT", "Legacy OLE2 binary or encrypted Office file is not supported");
  }
  if (!Buffer.from(bytes.subarray(0, 4)).equals(ZIP_MAGIC)) {
    throw new OoxmlBlockedError("INVALID_ZIP", "Missing ZIP magic header");
  }
  precheckZipCentralDirectory(bytes, quotas);
  let entries;
  try {
    entries = unzipSync(bytes);
  } catch (err2) {
    throw new OoxmlBlockedError("INVALID_ZIP", `Failed to inflate OOXML: ${err2 instanceof Error ? err2.message : String(err2)}`);
  }
  if ("EncryptionInfo" in entries || "EncryptedPackage" in entries) {
    throw new OoxmlBlockedError("ENCRYPTED_OOXML", "Password-protected OOXML archives are blocked");
  }
  let totalBytes = 0;
  for (const [name2, data] of Object.entries(entries)) {
    if (data.byteLength > quotas.maxSingleFileBytes) {
      throw new OoxmlBlockedError("ZIP_BOMB_QUOTA", `Inflated entry ${name2} exceeds maxSingleFileBytes`);
    }
    totalBytes += data.byteLength;
    if (totalBytes > quotas.maxTotalBytes) {
      throw new OoxmlBlockedError("ZIP_BOMB_QUOTA", "Total inflated bytes exceed maxTotalBytes");
    }
    if (name2.endsWith(".xml") || name2.endsWith(".rels")) {
      assertNoXxe(strFromU8(data), name2);
    }
  }
  return entries;
}
function extractDocxFromEntries(entries) {
  if (!("word/document.xml" in entries)) {
    throw new OoxmlBlockedError("INVALID_ZIP", "DOCX missing word/document.xml");
  }
  const parts = [
    "word/document.xml",
    ...Object.keys(entries).filter((k) => /^word\/(?:header|footer)\d+\.xml$/i.test(k)).sort()
  ];
  const paragraphs = [];
  for (const part of parts) {
    const raw = entries[part];
    if (!raw) continue;
    const xml = strFromU8(raw).replace(/<w:altChunk\b[^>]*(?:\/>|>[\s\S]*?<\/w:altChunk>)/gi, "").replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/gi, "").replace(/<w:delText\b[^>]*>[\s\S]*?<\/w:delText>/gi, "").replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/gi, "");
    const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi;
    let pm;
    while ((pm = pRe.exec(xml)) !== null) {
      const body = pm[1] ?? "";
      const pieces = [];
      const tRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/gi;
      let tm;
      while ((tm = tRe.exec(body)) !== null) {
        if (tm[1] !== void 0) pieces.push(decodeXmlEntities(tm[1]));
        else if (tm[0].toLowerCase().startsWith("<w:tab")) pieces.push("	");
        else pieces.push("\n");
      }
      const line = pieces.join("").replace(/[ \t]+/g, " ").trim();
      if (line.length > 0) paragraphs.push(line);
    }
  }
  return paragraphs.join("\n");
}
function extractXlsxFromEntries(entries) {
  const sharedStrings = [];
  if (entries["xl/sharedStrings.xml"]) {
    const ssXml = strFromU8(entries["xl/sharedStrings.xml"]);
    const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
    let sm;
    while ((sm = siRe.exec(ssXml)) !== null) {
      const texts = [];
      const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
      let tm;
      while ((tm = tRe.exec(sm[1] ?? "")) !== null) {
        texts.push(decodeXmlEntities(tm[1] ?? ""));
      }
      sharedStrings.push(texts.join(""));
    }
  }
  const sheetParts = Object.keys(entries).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k)).sort((a, b) => {
    const na = Number.parseInt(/sheet(\d+)/i.exec(a)?.[1] ?? "0", 10);
    const nb = Number.parseInt(/sheet(\d+)/i.exec(b)?.[1] ?? "0", 10);
    return na - nb;
  });
  if (sheetParts.length === 0) {
    throw new OoxmlBlockedError("INVALID_ZIP", "XLSX missing xl/worksheets/sheet*.xml");
  }
  const output = [];
  for (const part of sheetParts) {
    const xml = strFromU8(entries[part]);
    output.push(`# ${part.replace(/^xl\/worksheets\//i, "").replace(/\.xml$/i, "")}`);
    const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
    let rm;
    while ((rm = rowRe.exec(xml)) !== null) {
      const cells = [];
      const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
      let cm;
      while ((cm = cellRe.exec(rm[1] ?? "")) !== null) {
        const attrs = cm[1] ?? "";
        const inner = cm[2] ?? "";
        const typeMatch = /\bt\s*=\s*["']([^"']+)["']/i.exec(attrs);
        const cellType = typeMatch?.[1] ?? "";
        if (cellType === "inlineStr") {
          const tMatch = /<t\b[^>]*>([\s\S]*?)<\/t>/i.exec(inner);
          cells.push(decodeXmlEntities(tMatch?.[1] ?? ""));
        } else {
          const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(inner);
          const rawVal = decodeXmlEntities(vMatch?.[1] ?? "");
          if (cellType === "s") {
            const idx = Number.parseInt(rawVal, 10);
            cells.push(Number.isInteger(idx) && sharedStrings[idx] !== void 0 ? sharedStrings[idx] : rawVal);
          } else {
            cells.push(rawVal);
          }
        }
      }
      const line = cells.filter((c) => c.trim().length > 0).join(" | ");
      if (line.length > 0) output.push(line);
    }
  }
  return output.join("\n");
}
function extractPptxFromEntries(entries) {
  const slideParts = Object.keys(entries).filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k)).sort((a, b) => {
    const na = Number.parseInt(/slide(\d+)/i.exec(a)?.[1] ?? "0", 10);
    const nb = Number.parseInt(/slide(\d+)/i.exec(b)?.[1] ?? "0", 10);
    return na - nb;
  });
  if (slideParts.length === 0) {
    throw new OoxmlBlockedError("INVALID_ZIP", "PPTX missing ppt/slides/slide*.xml");
  }
  const output = [];
  slideParts.forEach((part, idx) => {
    const xml = strFromU8(entries[part]);
    const lines = [];
    const pRe = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/gi;
    let pm;
    while ((pm = pRe.exec(xml)) !== null) {
      const pieces = [];
      const tRe = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/gi;
      let tm;
      while ((tm = tRe.exec(pm[1] ?? "")) !== null) {
        pieces.push(decodeXmlEntities(tm[1] ?? ""));
      }
      const line = pieces.join("").trim();
      if (line.length > 0) lines.push(line);
    }
    if (lines.length > 0) {
      output.push(`# Slide ${idx + 1}
${lines.join("\n")}`);
    }
  });
  return output.join("\n\n");
}
function extractSafeOoxmlText(bytes, ext, quotas = {}) {
  const mergedQuotas = { ...DEFAULT_ZIP_QUOTAS, ...quotas };
  const entries = safeUnzipOoxml(bytes, mergedQuotas);
  if (ext === ".docx") return extractDocxFromEntries(entries);
  if (ext === ".xlsx") return extractXlsxFromEntries(entries);
  if (ext === ".pptx") return extractPptxFromEntries(entries);
  throw new OoxmlBlockedError("UNSUPPORTED_OOXML", `Unsupported OOXML extension: ${ext}`);
}

// src/core/extractors.ts
var TEXT_EXTENSIONS = /* @__PURE__ */ new Set([
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".jsonl",
  ".csv",
  ".tsv",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".xml",
  ".html",
  ".htm",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cs",
  ".sql",
  ".sh",
  ".ps1",
  ".css",
  ".scss",
  ".log"
]);
function stripHtmlTags(raw) {
  return raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
var ExtractorRegistry = class {
  custom = /* @__PURE__ */ new Map();
  zipQuotas;
  constructor(zipQuotas = {}) {
    this.zipQuotas = zipQuotas;
  }
  register(ext, fn) {
    const normalized = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    this.custom.set(normalized, fn);
    return () => {
      if (this.custom.get(normalized) === fn) {
        this.custom.delete(normalized);
      }
    };
  }
  isSupported(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.custom.has(ext) || TEXT_EXTENSIONS.has(ext) || ext === ".docx" || ext === ".xlsx" || ext === ".pptx";
  }
  listSupportedExtensions() {
    return [.../* @__PURE__ */ new Set([...TEXT_EXTENSIONS, ".docx", ".xlsx", ".pptx", ...this.custom.keys()])].sort();
  }
  async extract(bytes, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const customFn = this.custom.get(ext);
    if (customFn) {
      return await customFn(bytes, filePath);
    }
    if (ext === ".docx" || ext === ".xlsx" || ext === ".pptx") {
      return {
        text: extractSafeOoxmlText(bytes, ext, this.zipQuotas),
        extractor: `builtin-ooxml-${ext.slice(1)}`
      };
    }
    if (TEXT_EXTENSIONS.has(ext)) {
      const raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^\uFEFF/, "");
      if (ext === ".html" || ext === ".htm") {
        return { text: stripHtmlTags(raw), extractor: "builtin-html" };
      }
      return { text: raw, extractor: "builtin-text" };
    }
    throw new Error(`UNSUPPORTED_EXTENSION:${ext || "(none)"}`);
  }
};

// src/core/path-guard.ts
import fs from "node:fs";
import path2 from "node:path";
var PROTECTED_SEGMENTS = /* @__PURE__ */ new Set([
  ".ssh",
  ".aws",
  ".gnupg",
  ".gpg",
  ".kube",
  ".docker",
  ".git",
  "node_modules"
]);
var PROTECTED_BASENAME_PATTERNS = [
  /^\.env(?:\..+)?$/i,
  /^\.npmrc$/i,
  /^\.pypirc$/i,
  /^\.netrc$/i,
  /^id_(?:rsa|ed25519|ecdsa|dsa)(?:\.pub)?$/i,
  /^authorized_keys$/i,
  /^credentials(?:\.json)?$/i,
  /\.(?:pem|key|p12|pfx|jks|kdbx)$/i
];
function isProtectedKbPath(targetPath) {
  const normalized = targetPath.replaceAll("\\", "/");
  const segments = normalized.split("/").filter(Boolean);
  for (const seg of segments) {
    if (PROTECTED_SEGMENTS.has(seg.toLowerCase())) return true;
  }
  const base = path2.basename(targetPath);
  return PROTECTED_BASENAME_PATTERNS.some((re) => re.test(base));
}
function normalizeRealRoot(rootPath) {
  const resolved = path2.resolve(rootPath);
  return fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
}
function resolveConfinedKbPath(targetPath, registeredRoots) {
  if (!targetPath || targetPath.includes("\0")) {
    return { ok: false, code: "OUTSIDE_KB_ROOTS", message: "Invalid empty or null-byte path" };
  }
  if (isProtectedKbPath(targetPath)) {
    return { ok: false, code: "PROTECTED_PATH", message: `Protected credential/secret path denied: ${path2.basename(targetPath)}` };
  }
  const normalizedRoots = registeredRoots.map((r) => normalizeRealRoot(r));
  const candidates = [];
  if (path2.isAbsolute(targetPath)) {
    const abs = path2.resolve(targetPath);
    for (const root of normalizedRoots) {
      const prefix = root.endsWith(path2.sep) ? root : root + path2.sep;
      if (abs === root || abs.startsWith(prefix)) {
        candidates.push({ root, resolved: abs });
      }
    }
  } else {
    for (const root of normalizedRoots) {
      const abs = path2.resolve(root, targetPath);
      const prefix = root.endsWith(path2.sep) ? root : root + path2.sep;
      if (abs.startsWith(prefix)) {
        candidates.push({ root, resolved: abs });
      }
    }
  }
  if (candidates.length === 0) {
    return {
      ok: false,
      code: "OUTSIDE_KB_ROOTS",
      message: `Path "${targetPath}" is outside authorized KB roots (kbOnlyMode enforced).`
    };
  }
  for (const cand of candidates) {
    if (!fs.existsSync(cand.resolved)) continue;
    let realTarget;
    try {
      realTarget = fs.realpathSync(cand.resolved);
    } catch {
      continue;
    }
    const prefix = cand.root.endsWith(path2.sep) ? cand.root : cand.root + path2.sep;
    if (realTarget !== cand.root && !realTarget.startsWith(prefix)) {
      return {
        ok: false,
        code: "SYMLINK_ESCAPE",
        message: `Symlink target escapes authorized KB root: ${targetPath}`
      };
    }
    if (isProtectedKbPath(realTarget)) {
      return { ok: false, code: "PROTECTED_PATH", message: "Protected path denied after realpath resolution" };
    }
    return {
      ok: true,
      absPath: realTarget,
      rootPath: cand.root,
      relPath: path2.relative(cand.root, realTarget).replaceAll("\\", "/")
    };
  }
  return { ok: false, code: "NOT_FOUND", message: `KB document not found inside authorized roots: ${targetPath}` };
}

// src/storage/kb-sqlite.ts
var DEFAULT_MAX_FILE_BYTES = 25 * 1024 * 1024;
var DEFAULT_READ_LIMIT = 8e3;
var DEFAULT_MAX_READ_LIMIT = 32e3;
var DEFAULT_CHUNK_CHARS = 1500;
var DEFAULT_CHUNK_OVERLAP = 150;
function resolveDefaultDbPath() {
  const dshHome = process.env.DSH_HOME ?? path3.join(os.homedir(), ".dsh");
  return path3.join(dshHome, "governance", "local-kb.sqlite");
}
function sha256Buffer(buf) {
  return createHash("sha256").update(buf).digest("hex");
}
function docIdFor(absPath) {
  return createHash("sha256").update(absPath).digest("hex").slice(0, 24);
}
function chunkText(text, chunkChars, overlap) {
  if (text.length === 0) return [];
  const chunks = [];
  const step = Math.max(100, chunkChars - overlap);
  let start = 0;
  let index = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkChars);
    chunks.push({ index, start, end, content: text.slice(start, end) });
    if (end >= text.length) break;
    start += step;
    index += 1;
  }
  return chunks;
}
var LocalKbStore = class {
  dbPath;
  kbOnlyMode;
  maxFileBytes;
  defaultReadLimit;
  maxReadLimit;
  chunkChars;
  chunkOverlap;
  extractors;
  db;
  constructor(config = {}) {
    this.dbPath = config.dbPath ?? resolveDefaultDbPath();
    this.kbOnlyMode = config.kbOnlyMode ?? true;
    this.maxFileBytes = config.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
    this.defaultReadLimit = Math.max(256, config.defaultReadLimit ?? DEFAULT_READ_LIMIT);
    this.maxReadLimit = Math.max(this.defaultReadLimit, config.maxReadLimit ?? DEFAULT_MAX_READ_LIMIT);
    this.chunkChars = Math.max(300, config.chunkChars ?? DEFAULT_CHUNK_CHARS);
    this.chunkOverlap = Math.min(Math.floor(this.chunkChars / 2), Math.max(0, config.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP));
    this.extractors = new ExtractorRegistry(config.zipQuotas);
    if (this.dbPath !== ":memory:") {
      fs2.mkdirSync(path3.dirname(this.dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(this.dbPath);
    this.initSchema();
    for (const root of config.roots ?? []) {
      if (fs2.existsSync(root)) {
        this.addRoot(root);
      }
    }
  }
  initSchema() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS kb_roots (
        root_path TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        added_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS kb_documents (
        doc_id TEXT PRIMARY KEY,
        root_path TEXT NOT NULL,
        rel_path TEXT NOT NULL,
        abs_path TEXT NOT NULL UNIQUE,
        ext TEXT NOT NULL,
        extractor TEXT NOT NULL,
        source_hash TEXT NOT NULL,
        bytes INTEGER NOT NULL,
        mtime_ms REAL NOT NULL,
        total_chars INTEGER NOT NULL,
        full_text TEXT NOT NULL,
        indexed_at TEXT NOT NULL,
        FOREIGN KEY (root_path) REFERENCES kb_roots(root_path) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE IF NOT EXISTS kb_chunks (
        chunk_id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        char_start INTEGER NOT NULL,
        char_end INTEGER NOT NULL,
        content TEXT NOT NULL,
        FOREIGN KEY (doc_id) REFERENCES kb_documents(doc_id) ON DELETE CASCADE
      ) STRICT;

      CREATE INDEX IF NOT EXISTS idx_kb_chunks_doc ON kb_chunks(doc_id, chunk_index);

      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts_trigram USING fts5(
        content,
        tokenize='trigram'
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts_tokens USING fts5(
        tokens,
        tokenize='unicode61'
      );
    `);
  }
  registerExtractor(ext, fn) {
    return this.extractors.register(ext, fn);
  }
  addRoot(rootPath, label) {
    const realRoot = normalizeRealRoot(rootPath);
    if (!fs2.existsSync(realRoot) || !fs2.statSync(realRoot).isDirectory()) {
      throw new Error(`KB root does not exist or is not a directory: ${rootPath}`);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const effectiveLabel = label?.trim() || path3.basename(realRoot) || realRoot;
    this.db.prepare(
      `INSERT INTO kb_roots (root_path, label, added_at) VALUES (?, ?, ?)
         ON CONFLICT(root_path) DO UPDATE SET label = excluded.label`
    ).run(realRoot, effectiveLabel, now);
    return this.listRoots().find((r) => r.rootPath === realRoot);
  }
  removeRoot(rootPath) {
    const realRoot = normalizeRealRoot(rootPath);
    const docs = this.db.prepare("SELECT doc_id FROM kb_documents WHERE root_path = ?").all(realRoot);
    for (const d of docs) {
      this.deleteDocumentFts(d.doc_id);
    }
    const res = this.db.prepare("DELETE FROM kb_roots WHERE root_path = ?").run(realRoot);
    return Number(res.changes) > 0;
  }
  listRoots() {
    const rows = this.db.prepare(
      `SELECT r.root_path, r.label, r.added_at, COUNT(d.doc_id) AS doc_count
         FROM kb_roots r
         LEFT JOIN kb_documents d ON d.root_path = r.root_path
         GROUP BY r.root_path
         ORDER BY r.added_at ASC`
    ).all();
    return rows.map((r) => ({
      rootPath: r.root_path,
      label: r.label,
      addedAt: r.added_at,
      documentCount: Number(r.doc_count)
    }));
  }
  listDocuments(rootPath) {
    const rows = rootPath ? this.db.prepare(
      `SELECT doc_id, root_path, rel_path, abs_path, ext, extractor, source_hash, bytes, mtime_ms, total_chars, indexed_at
             FROM kb_documents WHERE root_path = ? ORDER BY rel_path ASC`
    ).all(normalizeRealRoot(rootPath)) : this.db.prepare(
      `SELECT doc_id, root_path, rel_path, abs_path, ext, extractor, source_hash, bytes, mtime_ms, total_chars, indexed_at
             FROM kb_documents ORDER BY root_path ASC, rel_path ASC`
    ).all();
    return rows.map((r) => ({
      docId: String(r.doc_id),
      rootPath: String(r.root_path),
      relPath: String(r.rel_path),
      absPath: String(r.abs_path),
      ext: String(r.ext),
      extractor: String(r.extractor),
      sourceHash: String(r.source_hash),
      bytes: Number(r.bytes),
      mtimeMs: Number(r.mtime_ms),
      totalChars: Number(r.total_chars),
      indexedAt: String(r.indexed_at)
    }));
  }
  deleteDocumentFts(docId) {
    const chunkRows = this.db.prepare("SELECT chunk_id FROM kb_chunks WHERE doc_id = ?").all(docId);
    const delTri = this.db.prepare("DELETE FROM chunks_fts_trigram WHERE rowid = ?");
    const delTok = this.db.prepare("DELETE FROM chunks_fts_tokens WHERE rowid = ?");
    for (const row of chunkRows) {
      delTri.run(row.chunk_id);
      delTok.run(row.chunk_id);
    }
    this.db.prepare("DELETE FROM kb_chunks WHERE doc_id = ?").run(docId);
  }
  async indexSingleFile(realRoot, absPath, relPath) {
    const stat = fs2.statSync(absPath);
    if (stat.size > this.maxFileBytes) {
      throw new Error(`FILE_TOO_LARGE:${stat.size}`);
    }
    const bytes = fs2.readFileSync(absPath);
    const sourceHash = sha256Buffer(bytes);
    const docId = docIdFor(absPath);
    const existing = this.db.prepare("SELECT source_hash FROM kb_documents WHERE doc_id = ?").get(docId);
    if (existing && existing.source_hash === sourceHash) {
      return "skipped";
    }
    const extracted = await this.extractors.extract(bytes, absPath);
    const chunks = chunkText(extracted.text, this.chunkChars, this.chunkOverlap);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.deleteDocumentFts(docId);
      this.db.prepare(
        `INSERT INTO kb_documents
            (doc_id, root_path, rel_path, abs_path, ext, extractor, source_hash, bytes, mtime_ms, total_chars, full_text, indexed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(doc_id) DO UPDATE SET
             rel_path = excluded.rel_path,
             extractor = excluded.extractor,
             source_hash = excluded.source_hash,
             bytes = excluded.bytes,
             mtime_ms = excluded.mtime_ms,
             total_chars = excluded.total_chars,
             full_text = excluded.full_text,
             indexed_at = excluded.indexed_at`
      ).run(
        docId,
        realRoot,
        relPath,
        absPath,
        path3.extname(absPath).toLowerCase(),
        extracted.extractor,
        sourceHash,
        stat.size,
        stat.mtimeMs,
        extracted.text.length,
        extracted.text,
        now
      );
      const insChunk = this.db.prepare(
        "INSERT INTO kb_chunks (doc_id, chunk_index, char_start, char_end, content) VALUES (?, ?, ?, ?, ?)"
      );
      const insTri = this.db.prepare("INSERT INTO chunks_fts_trigram (rowid, content) VALUES (?, ?)");
      const insTok = this.db.prepare("INSERT INTO chunks_fts_tokens (rowid, tokens) VALUES (?, ?)");
      for (const ch of chunks) {
        const res = insChunk.run(docId, ch.index, ch.start, ch.end, ch.content);
        const rowid = Number(res.lastInsertRowid);
        insTri.run(rowid, ch.content);
        insTok.run(rowid, tokenizeForFts(ch.content));
      }
      this.db.exec("COMMIT");
    } catch (err2) {
      this.db.exec("ROLLBACK");
      throw err2;
    }
    return "indexed";
  }
  async indexRoot(rootPath) {
    const rootRec = this.addRoot(rootPath);
    const realRoot = rootRec.rootPath;
    const rootPrefix = realRoot.endsWith(path3.sep) ? realRoot : realRoot + path3.sep;
    let scanned = 0;
    let indexed = 0;
    let skippedUnchanged = 0;
    const blocked = [];
    const seenDocIds = /* @__PURE__ */ new Set();
    const walk = async (dir) => {
      const entries = fs2.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path3.join(dir, entry.name);
        if (isProtectedKbPath(fullPath)) continue;
        if (entry.isSymbolicLink()) {
          let realTarget;
          try {
            realTarget = fs2.realpathSync(fullPath);
          } catch {
            continue;
          }
          if (!realTarget.startsWith(rootPrefix)) {
            blocked.push({ path: fullPath, reason: "SYMLINK_ESCAPE" });
            continue;
          }
          if (fs2.statSync(realTarget).isDirectory()) continue;
        }
        if (entry.isDirectory()) {
          await walk(fullPath);
          continue;
        }
        if (!entry.isFile()) continue;
        if (!this.extractors.isSupported(fullPath)) continue;
        scanned += 1;
        const relPath = path3.relative(realRoot, fullPath).replaceAll("\\", "/");
        seenDocIds.add(docIdFor(fullPath));
        try {
          const outcome = await this.indexSingleFile(realRoot, fullPath, relPath);
          if (outcome === "indexed") indexed += 1;
          else skippedUnchanged += 1;
        } catch (err2) {
          blocked.push({
            path: relPath,
            reason: err2 instanceof Error ? `${err2.name}: ${err2.message}` : String(err2)
          });
        }
      }
    };
    await walk(realRoot);
    const existingDocs = this.db.prepare("SELECT doc_id FROM kb_documents WHERE root_path = ?").all(realRoot);
    let removed = 0;
    for (const d of existingDocs) {
      if (!seenDocIds.has(d.doc_id)) {
        this.deleteDocumentFts(d.doc_id);
        this.db.prepare("DELETE FROM kb_documents WHERE doc_id = ?").run(d.doc_id);
        removed += 1;
      }
    }
    return { rootPath: realRoot, scanned, indexed, skippedUnchanged, removed, blocked };
  }
  isFileStale(absPath, indexedHash) {
    try {
      const buf = fs2.readFileSync(absPath);
      return sha256Buffer(buf) !== indexedHash;
    } catch {
      return true;
    }
  }
  search(query, opts = {}) {
    const trimmed = query.trim();
    const limit = Math.min(50, Math.max(1, opts.limit ?? 10));
    if (!trimmed) {
      return { query, hits: [], totalHits: 0, truncated: false };
    }
    const filterRoot = opts.rootPath ? normalizeRealRoot(opts.rootPath) : void 0;
    const merged = /* @__PURE__ */ new Map();
    const runQuery = (table, ftsExpr, source) => {
      try {
        const sql = filterRoot ? `SELECT c.chunk_id, c.doc_id, c.chunk_index, c.char_start, c.char_end, c.content,
                    d.root_path, d.rel_path, d.abs_path, d.source_hash
             FROM ${table} f
             JOIN kb_chunks c ON c.chunk_id = f.rowid
             JOIN kb_documents d ON d.doc_id = c.doc_id
             WHERE ${table} MATCH ? AND d.root_path = ?
             ORDER BY bm25(${table}) ASC
             LIMIT ?` : `SELECT c.chunk_id, c.doc_id, c.chunk_index, c.char_start, c.char_end, c.content,
                    d.root_path, d.rel_path, d.abs_path, d.source_hash
             FROM ${table} f
             JOIN kb_chunks c ON c.chunk_id = f.rowid
             JOIN kb_documents d ON d.doc_id = c.doc_id
             WHERE ${table} MATCH ?
             ORDER BY bm25(${table}) ASC
             LIMIT ?`;
        const rows = filterRoot ? this.db.prepare(sql).all(ftsExpr, filterRoot, limit + 1) : this.db.prepare(sql).all(ftsExpr, limit + 1);
        for (const r of rows) {
          const chunkId = Number(r.chunk_id);
          const existing = merged.get(chunkId);
          if (existing) {
            existing.sources.add(source);
          } else {
            const absPath = String(r.abs_path);
            const sourceHash = String(r.source_hash);
            const stale = opts.checkFreshness === false ? false : this.isFileStale(absPath, sourceHash);
            merged.set(chunkId, {
              sources: /* @__PURE__ */ new Set([source]),
              hit: {
                docId: String(r.doc_id),
                rootPath: String(r.root_path),
                relPath: String(r.rel_path),
                absPath,
                sourceHash,
                stale,
                chunkIndex: Number(r.chunk_index),
                charStart: Number(r.char_start),
                charEnd: Number(r.char_end),
                excerpt: String(r.content).slice(0, 600)
              }
            });
          }
        }
      } catch {
      }
    };
    const triExpr = buildFtsTrigramQuery(trimmed);
    if (triExpr) runQuery("chunks_fts_trigram", triExpr, "trigram");
    const tokExpr = buildFtsTokenQuery(trimmed);
    if (tokExpr) runQuery("chunks_fts_tokens", tokExpr, "tokens");
    const allHits = [...merged.values()].map(({ hit, sources }) => ({
      ...hit,
      matchSource: sources.size === 2 ? "both" : sources.has("trigram") ? "trigram" : "tokens"
    }));
    allHits.sort((a, b) => {
      const rank = (s) => s === "both" ? 0 : s === "trigram" ? 1 : 2;
      return rank(a.matchSource) - rank(b.matchSource);
    });
    const truncated = allHits.length > limit;
    return {
      query: trimmed,
      hits: allHits.slice(0, limit),
      totalHits: allHits.length,
      truncated
    };
  }
  async read(targetPath, opts = {}) {
    const roots = this.listRoots().map((r) => r.rootPath);
    const confined = resolveConfinedKbPath(targetPath, roots);
    if (!confined.ok) {
      throw new Error(`${confined.code}: ${confined.message}`);
    }
    const docId = docIdFor(confined.absPath);
    let row = this.db.prepare(
      "SELECT doc_id, root_path, rel_path, abs_path, extractor, source_hash, total_chars, full_text FROM kb_documents WHERE doc_id = ?"
    ).get(docId);
    const liveHash = sha256Buffer(fs2.readFileSync(confined.absPath));
    let stale = !row || row.source_hash !== liveHash;
    let reindexed = false;
    if (!row || stale && opts.autoReindexIfStale !== false) {
      await this.indexSingleFile(confined.rootPath, confined.absPath, confined.relPath);
      row = this.db.prepare(
        "SELECT doc_id, root_path, rel_path, abs_path, extractor, source_hash, total_chars, full_text FROM kb_documents WHERE doc_id = ?"
      ).get(docId);
      reindexed = true;
      stale = false;
    }
    if (!row) {
      throw new Error(`KB_READ_FAILED: Unable to load document ${confined.relPath}`);
    }
    const offset = Math.max(0, Math.floor(opts.offset ?? 0));
    const limit = Math.min(this.maxReadLimit, Math.max(1, Math.floor(opts.limit ?? this.defaultReadLimit)));
    const totalChars = row.full_text.length;
    const content = row.full_text.slice(offset, offset + limit);
    const endPos = offset + content.length;
    const truncated = endPos < totalChars;
    return {
      path: row.abs_path,
      relPath: row.rel_path,
      rootPath: row.root_path,
      extractor: row.extractor,
      sourceHash: row.source_hash,
      stale,
      reindexed,
      offset,
      limit,
      totalChars,
      truncated,
      ...truncated ? { nextOffset: endPos } : {},
      content
    };
  }
  close() {
    this.db.close();
  }
};

// src/host/index.ts
var name = "dsh-local-kb";
function resolveSessionId(exec) {
  const agent = exec?.agent;
  if (agent?.session?.id) return agent.session.id;
  if (typeof exec?.sessionId === "string") return exec.sessionId;
  return "default-session";
}
function apply(ctx, config = {}) {
  const store = new LocalKbStore(config);
  const recordAudit = (input) => {
    const audit = ctx.get("governanceAudit");
    try {
      audit?.recordEvent?.(input);
    } catch {
    }
  };
  const registerEvidenceSpan = (input) => {
    const evSvc = ctx.get("governanceEvidence");
    try {
      const rec = evSvc?.registerEvidence?.({
        sessionId: input.sessionId,
        sourceType: "kb",
        locator: input.locator,
        excerpt: input.excerpt,
        fullText: input.fullText,
        sha256: input.sha256,
        truncated: input.truncated,
        nextOffset: input.nextOffset,
        auditability: input.truncated ? "partial" : "auditable"
      });
      return rec?.id;
    } catch {
      return void 0;
    }
  };
  const service = {
    addRoot: (rootPath, label) => {
      const rec = store.addRoot(rootPath, label);
      recordAudit({
        stream: "governance",
        eventName: "kb.root_added",
        actorType: "user",
        actorId: "local-owner",
        resourceType: "kb_root",
        resourceId: rec.rootPath,
        outcome: "success"
      });
      return rec;
    },
    removeRoot: (rootPath) => {
      const ok = store.removeRoot(rootPath);
      recordAudit({
        stream: "governance",
        eventName: "kb.root_removed",
        actorType: "user",
        actorId: "local-owner",
        resourceType: "kb_root",
        resourceId: rootPath,
        outcome: ok ? "success" : "failure"
      });
      return ok;
    },
    listRoots: () => store.listRoots(),
    indexRoot: async (rootPath) => {
      const summary = await store.indexRoot(rootPath);
      recordAudit({
        stream: "governance",
        eventName: "kb.indexed",
        actorType: "system",
        actorId: "dsh-local-kb",
        resourceType: "kb_root",
        resourceId: summary.rootPath,
        outcome: "success",
        payload: {
          scanned: summary.scanned,
          indexed: summary.indexed,
          skippedUnchanged: summary.skippedUnchanged,
          removed: summary.removed,
          blockedCount: summary.blocked.length
        }
      });
      return summary;
    },
    listDocuments: (rootPath) => store.listDocuments(rootPath),
    search: (query, opts) => {
      const res = store.search(query, opts);
      const sessionId = opts?.sessionId ?? "default-session";
      for (const hit of res.hits.slice(0, 5)) {
        registerEvidenceSpan({
          sessionId,
          locator: `${hit.relPath}#chunk-${hit.chunkIndex}`,
          excerpt: hit.excerpt,
          fullText: hit.excerpt,
          sha256: hit.sourceHash,
          truncated: true,
          nextOffset: hit.charEnd
        });
      }
      recordAudit({
        stream: "governance",
        eventName: "kb.search",
        actorType: "agent",
        actorId: sessionId,
        resourceType: "kb_index",
        outcome: "success",
        payload: { queryLength: query.length, hitCount: res.hits.length, truncated: res.truncated }
      });
      return res;
    },
    read: async (targetPath, opts = {}) => {
      const sessionId = opts.sessionId ?? "default-session";
      try {
        const res = await store.read(targetPath, opts);
        const evidenceId = registerEvidenceSpan({
          sessionId,
          locator: res.relPath,
          excerpt: res.content.slice(0, 2e3),
          fullText: res.content,
          sha256: res.sourceHash,
          truncated: res.truncated,
          nextOffset: res.nextOffset
        });
        recordAudit({
          stream: "governance",
          eventName: "kb.read",
          actorType: "agent",
          actorId: sessionId,
          resourceType: "kb_document",
          resourceId: res.relPath,
          outcome: "success",
          payload: {
            sourceHash: res.sourceHash,
            offset: res.offset,
            limit: res.limit,
            truncated: res.truncated,
            reindexed: res.reindexed
          }
        });
        return evidenceId ? { ...res, evidenceId } : res;
      } catch (err2) {
        recordAudit({
          stream: "security",
          eventName: "kb.read_denied",
          actorType: "agent",
          actorId: sessionId,
          resourceType: "kb_document",
          resourceId: targetPath,
          outcome: "denied",
          payload: { reason: err2 instanceof Error ? err2.message : String(err2) }
        });
        throw err2;
      }
    },
    registerExtractor: (ext, fn) => store.registerExtractor(ext, fn),
    getSupportedExtensions: () => store.extractors.listSupportedExtensions(),
    getConfig: () => ({
      kbOnlyMode: store.kbOnlyMode,
      defaultReadLimit: store.defaultReadLimit,
      maxReadLimit: store.maxReadLimit,
      dbPath: store.dbPath
    }),
    close: () => store.close()
  };
  ctx.provide?.("governanceKb", service);
  const toolDisposers = [];
  const registerKbTools = (tools, target) => {
    if (!tools || typeof tools.register !== "function") return;
    target.push(
      tools.register({
        name: "kb_list_roots",
        description: "List authorized local knowledge base roots and indexed document counts.",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false
        },
        output: {
          schema: {
            type: "object",
            properties: {
              roots: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    rootPath: { type: "string" },
                    label: { type: "string" },
                    addedAt: { type: "string" },
                    documentCount: { type: "number" }
                  },
                  required: ["rootPath", "label", "addedAt", "documentCount"],
                  additionalProperties: false
                }
              }
            },
            required: ["roots"],
            additionalProperties: false
          },
          render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }]
        },
        isConcurrencySafe: () => true,
        execute: async () => ({ roots: service.listRoots() })
      })
    );
    target.push(
      tools.register({
        name: "kb_search",
        description: "Deterministic FTS5 search across authorized local KB documents (supports 2+ char CJK and ASCII substrings).",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query (Chinese/CJK 2+ chars or ASCII keywords)." },
            limit: { type: "number", description: "Max hits to return (1..50, default 10)." },
            rootPath: { type: "string", description: "Optional KB root filter." }
          },
          required: ["query"],
          additionalProperties: false
        },
        output: {
          schema: {
            type: "object",
            properties: {
              query: { type: "string" },
              totalHits: { type: "number" },
              truncated: { type: "boolean" },
              hits: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    docId: { type: "string" },
                    rootPath: { type: "string" },
                    relPath: { type: "string" },
                    absPath: { type: "string" },
                    sourceHash: { type: "string" },
                    stale: { type: "boolean" },
                    chunkIndex: { type: "number" },
                    charStart: { type: "number" },
                    charEnd: { type: "number" },
                    excerpt: { type: "string" },
                    matchSource: { type: "string" }
                  },
                  required: ["docId", "relPath", "sourceHash", "stale", "excerpt"],
                  additionalProperties: true
                }
              }
            },
            required: ["query", "totalHits", "truncated", "hits"],
            additionalProperties: false
          },
          render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }]
        },
        isConcurrencySafe: () => true,
        execute: async (rawArgs, exec) => {
          const args = rawArgs ?? {};
          return service.search(String(args.query ?? ""), {
            limit: typeof args.limit === "number" ? args.limit : void 0,
            rootPath: typeof args.rootPath === "string" ? args.rootPath : void 0,
            sessionId: resolveSessionId(exec)
          });
        }
      })
    );
    target.push(
      tools.register({
        name: "kb_read",
        description: "Read a bounded paginated slice of an authorized local KB document with source_hash freshness verification and mandatory truncated/nextOffset flags.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Relative path inside a KB root or confined absolute path." },
            offset: { type: "number", description: "Start character offset (default 0)." },
            limit: { type: "number", description: "Max characters to return (bounded by maxReadLimit)." }
          },
          required: ["path"],
          additionalProperties: false
        },
        output: {
          schema: {
            type: "object",
            properties: {
              path: { type: "string" },
              relPath: { type: "string" },
              rootPath: { type: "string" },
              extractor: { type: "string" },
              sourceHash: { type: "string" },
              stale: { type: "boolean" },
              reindexed: { type: "boolean" },
              offset: { type: "number" },
              limit: { type: "number" },
              totalChars: { type: "number" },
              truncated: { type: "boolean" },
              nextOffset: { type: "number" },
              content: { type: "string" },
              evidenceId: { type: "string" }
            },
            required: ["relPath", "sourceHash", "offset", "limit", "totalChars", "truncated", "content"],
            additionalProperties: true
          },
          render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }]
        },
        isConcurrencySafe: () => true,
        execute: async (rawArgs, exec) => {
          const args = rawArgs ?? {};
          return await service.read(String(args.path ?? ""), {
            offset: typeof args.offset === "number" ? args.offset : void 0,
            limit: typeof args.limit === "number" ? args.limit : void 0,
            sessionId: resolveSessionId(exec)
          });
        }
      })
    );
  };
  if (typeof ctx.inject === "function") {
    ctx.inject(["tools"], (scope) => {
      const ts = scope.get("tools");
      if (!ts) return;
      const local = [];
      registerKbTools(ts, local);
      scope.effect?.(() => () => {
        for (const d of local) {
          try {
            d();
          } catch {
          }
        }
      }, "dsh-local-kb: tools");
    });
  } else {
    const ts = ctx.get("tools");
    if (ts) registerKbTools(ts, toolDisposers);
  }
  let disposeRoute;
  const registerConnectionRoute = (connection) => {
    if (!connection?.fetch?.register) return void 0;
    return connection.fetch.register({
      path: "/api/dshLocalKb",
      methods: ["POST"],
      requestBody: "buffered",
      fetch: async (request) => {
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response("body is not JSON", { status: 400 });
        }
        const rpcId = typeof body?.rpcId === "string" ? body.rpcId : "00000000-0000-0000-0000-000000000000";
        const isDshEnvelope = body?.type === "client-request" && body?.payload && typeof body.payload === "object";
        const envelope = isDshEnvelope ? body.payload : body;
        const method = typeof envelope.method === "string" ? envelope.method : "status";
        const payload = envelope.payload && typeof envelope.payload === "object" ? envelope.payload : {};
        const dispatch = async () => {
          try {
            if (method === "status") {
              return {
                ok: true,
                value: {
                  config: service.getConfig(),
                  roots: service.listRoots(),
                  supportedExtensions: service.getSupportedExtensions()
                }
              };
            }
            if (method === "listRoots") {
              return { ok: true, value: { roots: service.listRoots() } };
            }
            if (method === "addRoot") {
              const rootPath = String(payload.rootPath ?? "");
              const label = typeof payload.label === "string" ? payload.label : void 0;
              const root = service.addRoot(rootPath, label);
              const summary = payload.indexNow === false ? null : await service.indexRoot(root.rootPath);
              return { ok: true, value: { root, summary } };
            }
            if (method === "removeRoot") {
              return { ok: true, value: { removed: service.removeRoot(String(payload.rootPath ?? "")) } };
            }
            if (method === "indexRoot") {
              return { ok: true, value: await service.indexRoot(String(payload.rootPath ?? "")) };
            }
            if (method === "listDocuments") {
              return {
                ok: true,
                value: {
                  documents: service.listDocuments(typeof payload.rootPath === "string" ? payload.rootPath : void 0)
                }
              };
            }
            if (method === "search") {
              return {
                ok: true,
                value: service.search(String(payload.query ?? ""), {
                  limit: typeof payload.limit === "number" ? payload.limit : void 0,
                  rootPath: typeof payload.rootPath === "string" ? payload.rootPath : void 0
                })
              };
            }
            if (method === "read") {
              return {
                ok: true,
                value: await service.read(String(payload.path ?? ""), {
                  offset: typeof payload.offset === "number" ? payload.offset : void 0,
                  limit: typeof payload.limit === "number" ? payload.limit : void 0
                })
              };
            }
            return {
              ok: false,
              error: { code: "dsh-local-kb/not-found", message: `Unknown method: ${method}`, details: {} }
            };
          } catch (err2) {
            return {
              ok: false,
              error: { code: "dsh-local-kb/error", message: err2 instanceof Error ? err2.message : String(err2), details: {} }
            };
          }
        };
        return Response.json({ type: "server-response", rpcId, result: await dispatch() });
      }
    });
  };
  if (typeof ctx.inject === "function") {
    ctx.inject(["connection"], (scope) => {
      const conn = scope.get("connection");
      if (!conn) return;
      const disposer = registerConnectionRoute(conn);
      if (disposer) scope.effect?.(() => disposer, "dsh-local-kb: connection route");
    });
  } else {
    const conn = ctx.get("connection");
    if (conn) disposeRoute = registerConnectionRoute(conn);
  }
  ctx.effect?.(() => {
    return async () => {
      for (const d of toolDisposers) d();
      await disposeRoute?.();
      store.close();
    };
  }, "dsh-local-kb: cleanup");
  return service;
}
export {
  DEFAULT_ZIP_QUOTAS,
  ExtractorRegistry,
  LocalKbStore,
  OoxmlBlockedError,
  apply,
  buildFtsTokenQuery,
  buildFtsTrigramQuery,
  extractSafeOoxmlText,
  hasCjk,
  isProtectedKbPath,
  name,
  normalizeRealRoot,
  precheckZipCentralDirectory,
  resolveConfinedKbPath,
  tokenizeForFts
};
