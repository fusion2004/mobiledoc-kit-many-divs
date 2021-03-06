'use strict';

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _parsersMobiledoc = require('../parsers/mobiledoc');

var _utilsCursorRange = require('../utils/cursor/range');

var _utilsCursorPosition = require('../utils/cursor/position');

var _utilsFixedQueue = require('../utils/fixed-queue');

function findLeafSectionAtIndex(post, index) {
  var section = undefined;
  post.walkAllLeafSections(function (_section, _index) {
    if (index === _index) {
      section = _section;
    }
  });
  return section;
}

var Snapshot = (function () {
  function Snapshot(editor) {
    _classCallCheck(this, Snapshot);

    this.mobiledoc = editor.serialize();
    this.editor = editor;

    this.snapshotRange();
  }

  _createClass(Snapshot, [{
    key: 'snapshotRange',
    value: function snapshotRange() {
      var _editor = this.editor;
      var range = _editor.range;
      var cursor = _editor.cursor;

      if (cursor.hasCursor() && !range.isBlank) {
        var head = range.head;
        var tail = range.tail;

        this.range = {
          head: [head.leafSectionIndex, head.offset],
          tail: [tail.leafSectionIndex, tail.offset]
        };
      }
    }
  }, {
    key: 'getRange',
    value: function getRange(post) {
      if (this.range) {
        var _range = this.range;
        var head = _range.head;
        var tail = _range.tail;

        var _head = _slicedToArray(head, 2);

        var headLeafSectionIndex = _head[0];
        var headOffset = _head[1];

        var _tail = _slicedToArray(tail, 2);

        var tailLeafSectionIndex = _tail[0];
        var tailOffset = _tail[1];

        var headSection = findLeafSectionAtIndex(post, headLeafSectionIndex);
        var tailSection = findLeafSectionAtIndex(post, tailLeafSectionIndex);

        return new _utilsCursorRange['default'](new _utilsCursorPosition['default'](headSection, headOffset), new _utilsCursorPosition['default'](tailSection, tailOffset));
      }
    }
  }]);

  return Snapshot;
})();

exports.Snapshot = Snapshot;

var EditHistory = (function () {
  function EditHistory(editor, queueLength) {
    _classCallCheck(this, EditHistory);

    this.editor = editor;
    this._undoStack = new _utilsFixedQueue['default'](queueLength);
    this._redoStack = new _utilsFixedQueue['default'](queueLength);

    this._pendingSnapshot = null;
  }

  _createClass(EditHistory, [{
    key: 'snapshot',
    value: function snapshot() {
      // update the current snapshot with the range read from DOM
      if (this._pendingSnapshot) {
        this._pendingSnapshot.snapshotRange();
      }
    }
  }, {
    key: 'storeSnapshot',
    value: function storeSnapshot() {
      // store pending snapshot
      if (this._pendingSnapshot) {
        this._undoStack.push(this._pendingSnapshot);
        this._redoStack.clear();
      }

      // take new pending snapshot to store next time `storeSnapshot` is called
      this._pendingSnapshot = new Snapshot(this.editor);
    }
  }, {
    key: 'stepBackward',
    value: function stepBackward(postEditor) {
      // Throw away the pending snapshot
      this._pendingSnapshot = null;

      var snapshot = this._undoStack.pop();
      if (snapshot) {
        this._redoStack.push(new Snapshot(this.editor));
        this._restoreFromSnapshot(snapshot, postEditor);
      }
    }
  }, {
    key: 'stepForward',
    value: function stepForward(postEditor) {
      var snapshot = this._redoStack.pop();
      if (snapshot) {
        this._undoStack.push(new Snapshot(this.editor));
        this._restoreFromSnapshot(snapshot, postEditor);
      }
      postEditor.cancelSnapshot();
    }
  }, {
    key: '_restoreFromSnapshot',
    value: function _restoreFromSnapshot(snapshot, postEditor) {
      var mobiledoc = snapshot.mobiledoc;
      var editor = this.editor;
      var builder = editor.builder;
      var post = editor.post;

      var restoredPost = _parsersMobiledoc['default'].parse(builder, mobiledoc);

      postEditor.removeAllSections();
      postEditor.migrateSectionsFromPost(restoredPost);

      // resurrect snapshotted range if it exists
      var newRange = snapshot.getRange(post);
      if (newRange) {
        postEditor.setRange(newRange);
      }
    }
  }]);

  return EditHistory;
})();

exports['default'] = EditHistory;