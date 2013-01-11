//JSHint globals
/*global
window:true,
document:true,
rangy:true,
*/
//--------------------------------------


function insertNodeAtCaret(node) {
	console.log(node);
    var sel = rangy.getSelection();
    if (sel.rangeCount) {
        var range = sel.getRangeAt(0);
        range.collapse(false);
        range.insertNode(node);
        range.collapseAfter(node);
        sel.setSingleRange(range);
    }
}

//this function returns a new text node by slicing the previous in place
//so be careful with it
var sliceTextNode = function( textNode, start, end){
	var slicedNode = textNode.splitText(start);
	slicedNode.splitText( end - start );//trimming the end
	return slicedNode;
};

var sanatizeColor = function( stringHtml ){
	return stringHtml.replace(/<\/?(fader)[^>]*>/gi,"").//removes fader elements, since css applies color to them, but not its content
		replace(/(color="[^"]*"|color:[^;]*;)(?=[^><]*>)/gi, "").//remove inline color coding, inside style and as attribute
		replace(/style="[ ]*"/gi, "");//delete empty styles that may end up remaining
};

var sanatizeColorInElementContent = function(node){
	if (node.innerHTML) node.innerHTML = sanatizeColor(node.innerHTML);
	return node;
};

var santizeColorInElement = function(node){
	console.log("node.outterHTML: "+node.outterHTML);
	$(node).removeAttr("color");
	if ($(node).attr('style')) $(node).css('color', '');
	return sanatizeColorInElementContent(node);
};

var fadeNode = function(node){
	if ( $(node).text().length === 0) return;//no need to fade without any text in it
	console.log("fadeNode");
	console.log(node);
	var outNode = $(node).wrap('<fader />').parent()[0];//wrap returns the wrapped element, not the wrapper
	$(outNode).css({
		//"-webkit-animation-name":		"cooling-lava",
		//"-webkit-animation-duration":	"5s"
	});
	//console.log("html: "+outNode.innerHTML);
	santizeColorInElement(outNode);
	//console.log("san_html: "+outNode.innerHTML);
	return outNode;
};

//be careful, this function effectively changes the data of textNode, since the node gets split
//in order to return the text node that is in fact new
var fleshOutInsertedTextNode = function(textNode, oldText){
	var newText = textNode.data;

	//flesh out the inserted piece of text
	var lengthCharsInserted = newText.length - oldText.length;
	if (lengthCharsInserted <= 0) return;

	var diffCharIndex = -1;
	var i = 0;
	while ( i<newText.length && diffCharIndex === -1){
		if ( newText[i] !== oldText[i]){
			diffCharIndex = i;
		}
		i++;
	}
	console.log("newText:"+newText);
	console.log("oldText"+oldText);
	console.log("diffCharIndex:"+diffCharIndex);
	console.log("lengthCharsInserted:"+lengthCharsInserted);

	var insertedTextNode = sliceTextNode( textNode, diffCharIndex, lengthCharsInserted + diffCharIndex );

	console.log("insertedTextNode");
	console.log( insertedTextNode && insertedTextNode.data );
	return insertedTextNode;
};

$(function(){
	var input = $(".input")[0];

	var silentMutation = false;

	$(input).on("webkitAnimationEnd","fader", function(e){
		//console.log("animationend");
		//console.log(this);
		//BUG: unwrapping will cause reflow of its children, which if still fading will restart their animation
		//FAILED ATTEMPTS:
		//	using inline style instead of CSS selectors doesn't work, the reflow still happens
		//Possible solutions:
		//	on mutation don't just wrap the inserted node, but make it a sibling of his parent as well
		return;
		silentMutation = true;
		var savedSel = rangy.saveSelection();
		$(this).contents().unwrap();
		$(this).remove();
		input.normalize();
		rangy.restoreSelection(savedSel);
		
	});
	

	var mutationSummaryHandler = function(summary){
		console.log("MUTATION!");
		var changes = summary[0];
		window.changes = changes;


		changes.added.forEach(function(addedNode){
			console.log("added node");
			console.log(addedNode);
			if ( $(addedNode).parent().is("fader") && $(addedNode).parent().children().length === 1 ){
				console.log("already fading");
				santizeColorInElement(addedNode);
				return;
			}
			fadeNode(addedNode);
		});


		changes.removed.forEach(function(removedNode){
			console.log("removedNode");
			console.log(removedNode);
			//not possible to do node clean up, because the node is no longer on the tree,
			//therefore there is no reference to his lost father

			var oldParent = changes.getOldParentNode(removedNode);
			var oldParentParents = $(oldParent).parentsUntil(input);

			if (oldParent !== input){
				$(oldParent).add( oldParentParents ).each(function(index, node){
					if ($(node).is(":empty")) $(node).remove();
				});
			}
		});

		var hasTextNodeBeenCreated = function(textNode, getOldCharacterData){
			//even though mutation summary reports characterDataChanged
			//it doesn't mean it's an update, a new text node is also reported
			//the way to make the distinction is by looking if there is a previous value
			//if it had in fact changed, been update rather than a creation, the previous
			//and current value would be different
			return textNode.data === getOldCharacterData(textNode);
		};

		changes.characterDataChanged.forEach(function(changedTextNode){
			console.log("characterDataChanged");
			console.log(changedTextNode);

			window.changedTextNode = changedTextNode;

			var insertedTextNode;//the text node that is really new on the dom
			if ( hasTextNodeBeenCreated(changedTextNode, changes.getOldCharacterData) ){
				insertedTextNode = changedTextNode;
			}
			else{
				var oldText = changes.getOldCharacterData(changedTextNode);
				insertedTextNode = fleshOutInsertedTextNode(changedTextNode, oldText );
			}
			
			console.log("insertedTextNode.data:"+ insertedTextNode && insertedTextNode.data);
			if (!insertedTextNode || !insertedTextNode.data ){
				$(insertedTextNode).remove();
				return;
			}

			var nodeClone = fadeNode( $(insertedTextNode).clone()[0] );

			insertNodeAtCaret( nodeClone );

			$(insertedTextNode).remove();
		});
	};

	var mutations = new MutationSummary({
		callback: mutationSummaryHandler, // required
		rootNode: input, // optional, defaults to window.document
		observeOwnChanges: false,// optional, defaults to false
		oldPreviousSibling: false,// optional, defaults to false
		queries: [{ all: true }]
	});
});