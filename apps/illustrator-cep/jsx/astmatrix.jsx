/* Loaded after json.jsx and renderer.jsx by the host build. ES3 only. */
(function (api) {
    var documents = [], nextDocument = 0, revision = 0, lastDocument = null, lastBoard = -1;
    var transfers = {}, nextObject = 0;
    api.error = function (code, message) { var e = new Error(message); e.code = code; return e; };
    api.snapshot = function () {
        var doc = app.documents.length ? app.activeDocument : null, id = null, board = -1, i, j, found;
        // Prune closed document references; IDs are never reused during this engine session.
        for (i = documents.length - 1; i >= 0; i--) {
            found = false; for (j = 0; j < app.documents.length; j++) if (documents[i].doc === app.documents[j]) found = true;
            if (!found) documents.splice(i, 1);
        }
        if (doc) {
            for (i = 0; i < documents.length; i++) if (documents[i].doc === doc) id = documents[i].id;
            if (!id) { id = 'ai-' + (++nextDocument); documents.push({ doc: doc, id: id }); }
            board = doc.artboards.getActiveArtboardIndex();
        }
        if (id !== lastDocument || board !== lastBoard) { revision++; lastDocument = id; lastBoard = board; }
        return { documentId: id, revision: revision, capabilities: {
            documentOpen: !!doc, canInsertNativeVector: !!doc, canUpdatePlacedObject: false,
            canPersistMetadata: true, supportsEditableText: true, supportsCompoundShapes: true
        } };
    };
    function metadata(m) {
        if (!m || m.schemaVersion !== 1 || typeof m.sourceValue !== 'string' || !m.symbologyId || !m.profileId || !m.engineVersion || !m.layoutVersion ||
            !m.request || m.request.symbologyId !== m.symbologyId || m.request.profileId !== m.profileId || !m.request.fields || !m.options ||
            !m.style || !m.dimensions || !/^[0-9a-fA-F]{6}$/.test(m.style.foreground) ||
            (m.style.background !== 'transparent' && !/^[0-9a-fA-F]{6}$/.test(m.style.background)) || typeof m.style.hri !== 'boolean' || m.style.font !== 'OCR-B' ||
            !(m.dimensions.moduleMm > 0) || !(m.dimensions.heightMm >= 0)) throw api.error('INVALID_INPUT', '无效元数据');
        finite(m.dimensions.moduleMm); finite(m.dimensions.heightMm);
        if (api.json.stringify(m).length > 65536) throw api.error('INVALID_INPUT', '元数据超过 64 KiB');
    }
    function finite(v) { if (typeof v !== 'number' || !isFinite(v)) throw api.error('INVALID_INPUT', '无效坐标'); }
    function color(c) {
        if (!c || (c.space !== 'RGB' && c.space !== 'CMYK')) throw api.error('INVALID_INPUT', '无效颜色');
        if (c.space === 'RGB') { if (typeof c.hex !== 'string' || !/^[0-9a-fA-F]{6}$/.test(c.hex)) throw api.error('INVALID_INPUT', '无效 RGB'); }
        else { var keys = ['c', 'm', 'y', 'k']; for (var i = 0; i < keys.length; i++) { finite(c[keys[i]]); if (c[keys[i]] < 0 || c[keys[i]] > 100) throw api.error('INVALID_INPUT', '无效 CMYK'); } }
    }
    function geometryBounds(g) {
        var left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity, current = null, i, c;
        function point(x, y) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
        function cubic(a, b, c, d, t) { var u = 1 - t; return u*u*u*a + 3*u*u*t*b + 3*u*t*t*c + t*t*t*d; }
        function extrema(a, b, c, d) {
            var qa = -a + 3*b - 3*c + d, qb = 2*(a - 2*b + c), qc = b - a, delta, roots = [];
            if (Math.abs(qa) < 0.000000000001) { if (Math.abs(qb) >= 0.000000000001) roots.push(-qc / qb); }
            else { delta = qb*qb - 4*qa*qc; if (delta >= 0) { roots.push((-qb + Math.sqrt(delta))/(2*qa)); roots.push((-qb - Math.sqrt(delta))/(2*qa)); } }
            return roots;
        }
        if (g.kind === 'rect') { point(g.x, g.y); point(g.x + g.w, g.y + g.h); }
        else if (g.kind === 'ellipse') { point(g.cx - g.rx, g.cy - g.ry); point(g.cx + g.rx, g.cy + g.ry); }
        else if (g.kind === 'polygon') { for (i = 0; i < g.points.length; i++) point(g.points[i].x, g.points[i].y); }
        else if (g.kind === 'text') {
            if (!g.bounds) throw api.error('INVALID_INPUT', '缺少文字边界');
            finite(g.bounds.x); finite(g.bounds.y); finite(g.bounds.width); finite(g.bounds.height);
            if (g.bounds.width < 0 || g.bounds.height < 0) throw api.error('INVALID_INPUT', '负文字边界');
            point(g.bounds.x, g.bounds.y); point(g.bounds.x + g.bounds.width, g.bounds.y + g.bounds.height);
        } else {
            for (i = 0; i < g.commands.length; i++) {
                c = g.commands[i]; if (c.op === 'Z') continue;
                if (c.op === 'C') {
                    var roots = extrema(current.x, c.x1, c.x2, c.x).concat(extrema(current.y, c.y1, c.y2, c.y));
                    for (var j = 0; j < roots.length; j++) if (roots[j] > 0 && roots[j] < 1) point(cubic(current.x, c.x1, c.x2, c.x, roots[j]), cubic(current.y, c.y1, c.y2, c.y, roots[j]));
                }
                point(c.x, c.y); current = c;
            }
        }
        return { left: left, top: top, right: right, bottom: bottom };
    }
    function scene(s) {
        if (!s || s.version !== 1 || s.units !== 'mm' || !(s.nodes instanceof Array) || !s.nodes.length || s.nodes.length > 20000) throw api.error('INVALID_INPUT', '无效 Scene');
        finite(s.widthMm); finite(s.heightMm); if (!(s.widthMm > 0 && s.heightMm > 0)) throw api.error('INVALID_INPUT', '无效尺寸');
        color(s.foreground); if (s.background) color(s.background); metadata(s.metadata);
        var bounds = [s.contentBounds, s.symbolBounds, s.quietZoneBounds], b, i, j, g, c, open, count, key, ids = {};
        for (i = 0; i < bounds.length; i++) {
            b = bounds[i]; if (!b) throw api.error('INVALID_INPUT', '缺少边界');
            finite(b.x); finite(b.y); finite(b.width); finite(b.height);
            if (b.x < 0 || b.y < 0 || b.width < 0 || b.height < 0 || b.x + b.width > s.widthMm + 0.00000001 || b.y + b.height > s.heightMm + 0.00000001) throw api.error('INVALID_INPUT', '边界超出 Scene');
        }
        b = s.quietZoneBounds; if (b.x !== 0 || b.y !== 0 || b.width !== s.widthMm || b.height !== s.heightMm) throw api.error('INVALID_INPUT', '静区尺寸不匹配');
        for (i = 0; i < s.nodes.length; i++) {
            var n = s.nodes[i]; if (!n.id || ids['$' + n.id]) throw api.error('INVALID_INPUT', '重复图元 ID'); ids['$' + n.id] = true;
            if (!/^(bars|modules|finder|text|quiet-zone|other)$/.test(n.role)) throw api.error('INVALID_INPUT', '无效角色');
            if (n.fill) color(n.fill); g = n.geometry; if (!g) throw api.error('INVALID_INPUT', '缺少几何');
            if (g.kind === 'rect') { finite(g.x); finite(g.y); finite(g.w); finite(g.h); if (!(g.w > 0 && g.h > 0)) throw api.error('INVALID_INPUT', '无效矩形'); }
            else if (g.kind === 'ellipse') { finite(g.cx); finite(g.cy); finite(g.rx); finite(g.ry); if (!(g.rx > 0 && g.ry > 0)) throw api.error('INVALID_INPUT', '无效椭圆'); }
            else if (g.kind === 'polygon') {
                if (!(g.points instanceof Array) || g.points.length < 3) throw api.error('INVALID_INPUT', '无效多边形');
                for (j = 0; j < g.points.length; j++) { finite(g.points[j].x); finite(g.points[j].y); }
            } else if (g.kind === 'path') {
                if (!(g.commands instanceof Array) || !g.commands.length || g.commands.length > 200000) throw api.error('INVALID_INPUT', '无效路径'); open = false; count = 0;
                for (j = 0; j < g.commands.length; j++) {
                    c = g.commands[j];
                    if (c.op === 'M') { if (open) throw api.error('INVALID_INPUT', '未闭合路径'); open = true; count = 1; }
                    else if (c.op === 'Z') { if (!open || count < 2) throw api.error('INVALID_INPUT', '空路径'); open = false; }
                    else if ((c.op !== 'L' && c.op !== 'C') || !open) throw api.error('INVALID_INPUT', '无效命令'); else count++;
                    if (c.op !== 'Z') { finite(c.x); finite(c.y); }
                    if (c.op === 'C') { finite(c.x1); finite(c.y1); finite(c.x2); finite(c.y2); }
                }
                if (open) throw api.error('INVALID_INPUT', '未闭合路径');
            } else if (g.kind === 'text') {
                finite(g.x); finite(g.y); finite(g.fontSizeMm); if (!(g.fontSizeMm > 0) || typeof g.text !== 'string' || !g.text) throw api.error('INVALID_INPUT', '无效文字');
                try { app.textFonts.getByName(g.fontFamily); } catch (fontError) { throw api.error('UNSUPPORTED_FEATURE', '未安装字体 ' + g.fontFamily); }
            } else throw api.error('UNSUPPORTED_FEATURE', '未知图元');
            var geometryBox = geometryBounds(g), allowed = n.role === 'quiet-zone' ? s.quietZoneBounds : s.contentBounds;
            if (geometryBox.left < allowed.x - 0.00000001 || geometryBox.top < allowed.y - 0.00000001 || geometryBox.right > allowed.x + allowed.width + 0.00000001 || geometryBox.bottom > allowed.y + allowed.height + 0.00000001) throw api.error('INVALID_INPUT', '图元超出内容边界');
            if ((g.kind === 'path' || g.kind === 'polygon') && g.fillRule !== 'nonzero' && g.fillRule !== 'evenodd') throw api.error('INVALID_INPUT', '无效填充规则');
        }
    }
    function textSignature(range) {
        var output = [], chars = range.characters, c, a, p, j;
        function paint(value) {
            if (!value) return '';
            if (value.typename === 'RGBColor') return [value.red, value.green, value.blue];
            if (value.typename === 'CMYKColor') return [value.cyan, value.magenta, value.yellow, value.black];
            if (value.typename === 'GrayColor') return [value.gray];
            if (value.typename === 'SpotColor') return [value.spot.name, value.tint];
            return value.typename;
        }
        for (j = 0; j < chars.length; j++) {
            c = chars[j]; a = c.characterAttributes; p = c.paragraphAttributes;
            output.push([a.textFont ? a.textFont.name : '', a.size, a.tracking, a.horizontalScale, a.verticalScale, a.baselineShift, a.capitalization, paint(a.fillColor), paint(a.strokeColor), p.justification, p.leftIndent, p.rightIndent, p.spaceBefore, p.spaceAfter]);
        }
        return api.json.stringify(output);
    }
    function textScan(scope, includeHidden) {
        var state = api.snapshot(), doc = app.documents.length ? app.activeDocument : null;
        if (!doc) throw api.error('NO_DOCUMENT', '请先打开文档');
        var selected = doc.selection || [], roots = scope === 'selected' ? selected : doc.textFrames;
        var board = scope === 'area' ? doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect : null;
        var ids = [], targets = [], seen = {}, i, characters = 0;
        function storyOf(item) {
            try { return item.story || (item.textRange && item.textRange.story) || null; } catch (error) { return null; }
        }
        function idOf(item) {
            var story = storyOf(item), j;
            if (story && story.textFrames && story.textFrames.length && story.textFrames[0].uuid)
                return 'story-u-' + story.textFrames[0].uuid;
            if (story) for (j = 0; j < doc.stories.length; j++) if (doc.stories[j] === story) return 'story-' + j;
            return item.uuid ? 'frame-' + item.uuid : 'frame-' + item.name;
        }
        function visit(item, hidden, locked) {
            if (!item) return;
            var parent = item.parent;
            while (parent && parent.typename !== 'Document') {
                hidden = hidden || parent.hidden === true || parent.visible === false;
                locked = locked || parent.locked === true;
                parent = parent.parent;
            }
            hidden = hidden || item.hidden === true || item.visible === false;
            locked = locked || item.locked === true;
            if (item.typename === 'Layer') { hidden = hidden || item.visible === false; locked = locked || item.locked === true; }
            if (item.typename === 'TextRange') {
                var selectedStory = storyOf(item), selectedFrame;
                if (selectedStory) for (var f = 0; f < doc.textFrames.length; f++) {
                    selectedFrame = doc.textFrames[f];
                    if (storyOf(selectedFrame) === selectedStory) { visit(selectedFrame, hidden, locked); return; }
                }
                if (item.parent) visit(item.parent, hidden, locked);
                return;
            }
            if (item.typename === 'TextFrame') {
                var id = idOf(item), story = storyOf(item), range = story ? story.textRange : item.textRange, reason = null, fingerprint = '';
                if (board) {
                    var bounds = item.geometricBounds;
                    if (!bounds || bounds[2] <= board[0] || bounds[0] >= board[2] || bounds[1] <= board[3] || bounds[3] >= board[1]) return;
                    if (bounds[0] < board[0] || bounds[2] > board[2] || bounds[1] > board[1] || bounds[3] < board[3] || (story && story.textFrames && story.textFrames.length > 1)) reason = 'read-only';
                }
                if (seen['$' + id]) return; seen['$' + id] = true;
                characters += range.contents.length;
                if (targets.length >= 10000 || characters > 1000000) throw api.error('UNSUPPORTED_FEATURE', '文字扫描超过单次处理上限，请缩小选区');
                try { fingerprint = textSignature(range); } catch (fontError) { reason = 'missing-font'; }
                if (range.characters.length !== range.contents.length) reason = 'rich-text';
                if (locked) reason = 'locked'; else if (hidden && !includeHidden) reason = 'hidden';
                targets.push({ id: id, name: item.name || id, text: range.contents, styleFingerprint: fingerprint, skipReason: reason });
                return;
            }
            if (item.pageItems) for (var k = 0; k < item.pageItems.length; k++) visit(item.pageItems[k], hidden, locked);
        }
        for (i = 0; i < selected.length; i++) ids.push(idOf(selected[i]));
        ids.sort();
        for (i = 0; i < roots.length; i++) visit(roots[i], false, false);
        return { documentId: state.documentId, revision: String(state.revision), scope: scope, includeHidden: includeHidden, selectionFingerprint: ids.join('|'), targets: targets };
    }
    function textApply(plan) {
        var scan = textScan(plan.scope, plan.includeHidden), byId = {}, i, j, change, target, doc = app.activeDocument, story, range, frame, count = 0;
        if (scan.documentId !== plan.documentId || scan.revision !== plan.revision ||
            (plan.scope === 'selected' && scan.selectionFingerprint !== plan.selectionFingerprint)) throw api.error('DOCUMENT_CHANGED', '文档或选区已变化，请重试');
        for (i = 0; i < scan.targets.length; i++) byId['$' + scan.targets[i].id] = scan.targets[i];
        for (i = 0; i < plan.changes.length; i++) {
            change = plan.changes[i]; target = byId['$' + change.id];
            if (!target || target.skipReason || target.text !== change.before || target.styleFingerprint !== change.styleFingerprint || change.before.length !== change.after.length)
                throw api.error('DOCUMENT_CHANGED', '文字或样式已变化，请重试');
            for (j = 0; j < change.before.length; j++) if (change.before.charAt(j) !== change.after.charAt(j)) {
                var oldChar = change.before.charAt(j), newChar = change.after.charAt(j);
                if (!/[A-Za-z]/.test(oldChar) || !/[A-Za-z]/.test(newChar) || oldChar.toLowerCase() !== newChar.toLowerCase() ||
                    (plan.operation === 'upper' && newChar !== oldChar.toUpperCase()) ||
                    (plan.operation === 'lower' && newChar !== oldChar.toLowerCase())) throw api.error('INVALID_INPUT', '文字计划包含非大小写变更');
            }
        }
        var applied = [];
        try {
            for (i = 0; i < plan.changes.length; i++) {
                change = plan.changes[i]; range = null;
                if (change.id.indexOf('story-') === 0) {
                    var storyKey = change.id.substr(6);
                    if (/^\d+$/.test(storyKey)) { story = doc.stories[Number(storyKey)]; if (story) range = story.textRange; }
                    else for (j = 0; j < doc.textFrames.length; j++) {
                        frame = doc.textFrames[j]; story = frame.story;
                        if (story && story.textFrames && story.textFrames.length && 'u-' + story.textFrames[0].uuid === storyKey) { range = story.textRange; break; }
                    }
                }
                else for (j = 0; j < doc.textFrames.length; j++) { frame = doc.textFrames[j]; if ('frame-' + (frame.uuid || frame.name) === change.id) { range = frame.textRange; break; } }
                if (!range || range.contents !== change.before) throw api.error('DOCUMENT_CHANGED', '文字对象已变化');
                applied.push({ range: range, before: change.before });
                for (j = 0; j < change.after.length; j++) if (change.after.charAt(j) !== change.before.charAt(j)) range.characters[j].contents = change.after.charAt(j);
                if (range.contents !== change.after) throw api.error('UNKNOWN_HOST_ERROR', '文字写回未通过校验');
                if (textSignature(range) !== change.styleFingerprint) throw api.error('UNSUPPORTED_FEATURE', '写入后样式变化，已恢复原文');
                count++;
            }
        } catch (failure) {
            for (i = applied.length - 1; i >= 0; i--) {
                range = applied[i].range;
                try { for (j = 0; j < applied[i].before.length; j++) if (range.characters[j].contents !== applied[i].before.charAt(j)) range.characters[j].contents = applied[i].before.charAt(j); } catch (rollback) { throw api.error('ROLLBACK_FAILED', '文字写入失败且恢复原文失败'); }
            }
            throw failure;
        }
        return { changed: count, failed: [], undoGrouped: false };
    }
    api.dispatch = function (request) {
        var id = request && request.requestId;
        try {
            if (typeof id !== 'string' || !/^[a-z0-9-]{1,256}$/i.test(id) || request.payloadVersion !== 1 || !request.payload || typeof request.payload !== 'object') throw api.error('INVALID_INPUT', '无效请求信封');
            var key, payload = request.payload, result, current;
            for (key in request) if (request.hasOwnProperty(key) && key !== 'requestId' && key !== 'payloadVersion' && key !== 'payload' && key !== 'operation') throw api.error('INVALID_INPUT', '未知信封字段');
            if (request.operation === 'capabilities' || request.operation === 'readSelectedMetadata') {
                for (key in payload) if (payload.hasOwnProperty(key)) throw api.error('INVALID_INPUT', '不接受操作参数');
                if (request.operation === 'capabilities') result = api.snapshot();
                else {
                    result = null;
                    if (app.documents.length && app.activeDocument.selection.length === 1) {
                        var item = app.activeDocument.selection[0];
                        // Walk up from an editable child to the owning AstMatrix group.
                        while (item && item.typename !== 'Document' && item.typename !== 'Layer') {
                            if (item.note && /^\{/.test(item.note)) {
                                var stored = api.json.parse(item.note);
                                if (stored.astmatrix === 1) { metadata(stored.metadata); result = stored.metadata; break; }
                            }
                            item = item.parent;
                        }
                    }
                }
            } else if (request.operation === 'textScan') {
                if ((payload.scope !== 'selected' && payload.scope !== 'area' && payload.scope !== 'document') || typeof payload.includeHidden !== 'boolean') throw api.error('INVALID_INPUT', '无效文字扫描参数');
                result = textScan(payload.scope, payload.includeHidden);
            } else if (request.operation === 'textApply') {
                if (!payload.plan || (payload.plan.scope !== 'selected' && payload.plan.scope !== 'area' && payload.plan.scope !== 'document') ||
                    (payload.plan.operation !== 'upper' && payload.plan.operation !== 'lower' && payload.plan.operation !== 'sentence' && payload.plan.operation !== 'restore') ||
                    (payload.plan.operation === 'restore' && payload.plan.sourceOperation !== 'upper' && payload.plan.sourceOperation !== 'lower' && payload.plan.sourceOperation !== 'sentence') ||
                    typeof payload.plan.includeHidden !== 'boolean' || !(payload.plan.changes instanceof Array) || payload.plan.changes.length > 10000) throw api.error('INVALID_INPUT', '无效文字变更计划');
                result = textApply(payload.plan);
            } else if (request.operation === 'insert') {
                for (key in payload) if (payload.hasOwnProperty(key) && key !== 'scene' && key !== 'documentId' && key !== 'documentRevision' && key !== 'placement') throw api.error('INVALID_INPUT', '未知插入参数');
                if (payload.placement !== 'center' && payload.placement !== 'selection') throw api.error('INVALID_INPUT', '无效定位');
                scene(payload.scene); current = api.snapshot();
                if (!current.documentId) throw api.error('NO_DOCUMENT', '请先打开文档');
                if (current.documentId !== payload.documentId || current.revision !== payload.documentRevision) throw api.error('DOCUMENT_CHANGED', '文档或画板已变化');
                result = api.render(app.activeDocument, payload.scene, payload.placement, 'ai-object-' + (++nextObject) + '-' + new Date().getTime());
            } else if (request.operation === 'update') throw api.error('UNSUPPORTED_FEATURE', '请读取参数后重新插入；暂不支持替换已有对象');
            else throw api.error('INVALID_INPUT', '未知操作');
            return api.json.stringify({ requestId: id, ok: true, result: result });
        } catch (error) {
            var info = { code: error.code || 'UNKNOWN_HOST_ERROR', message: String(error.message || error) };
            if (error.originalError) info.originalError = error.originalError; if (error.cleanupError) info.cleanupError = error.cleanupError;
            return api.json.stringify({ requestId: typeof id === 'string' ? id : '', ok: false, error: info });
        }
    };
    function purge() { var now = new Date().getTime(); for (var key in transfers) if (transfers.hasOwnProperty(key) && now - transfers[key].time > 30000) delete transfers[key]; }
    api.begin = function (id, count) {
        purge(); if (!/^[a-z0-9-]{1,256}$/i.test(id) || count < 1 || count > 512 || count !== Math.floor(count)) return 'INVALID_INPUT';
        for (var key in transfers) if (transfers.hasOwnProperty(key)) return 'HOST_BUSY';
        transfers[id] = { count: count, parts: [], size: 0, time: new Date().getTime() }; return 'OK';
    };
    api.append = function (id, index, chunk) {
        purge(); var t = transfers[id];
        if (!t || index !== t.parts.length || index >= t.count || typeof chunk !== 'string' || chunk.length > 16384 || !/^[a-z0-9%_.~-]*$/i.test(chunk) || t.size + chunk.length > 8388608) return 'INVALID_INPUT';
        t.parts.push(chunk); t.size += chunk.length; t.time = new Date().getTime(); return 'OK';
    };
    api.abort = function (id) { delete transfers[id]; return 'OK'; };
    api.finish = function (id) {
        purge(); var t = transfers[id]; delete transfers[id];
        try {
            if (!t || t.parts.length !== t.count) throw api.error('INVALID_INPUT', '不完整传输');
            var request = api.json.parse(decodeURIComponent(t.parts.join('')));
            if (request.requestId !== id) throw api.error('INVALID_INPUT', 'requestId 不匹配');
            return api.dispatch(request);
        } catch (error) { return api.json.stringify({ requestId: id, ok: false, error: { code: 'INVALID_INPUT', message: String(error) } }); }
    };
})($._astmatrix);
