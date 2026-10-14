import dev.latvian.mods.rhino.Context;
import dev.latvian.mods.rhino.ContextFactory;
import dev.latvian.mods.rhino.ScriptableObject;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Evaluates JavaScript files in order, in one shared scope, on a real KubeJS Rhino jar: the KubeJS
 * stub, the built bundle, then the scenario that drives the bundle's handlers and asserts on what
 * they did. Any script error is thrown, so the process exits non-zero with Rhino's message.
 *
 * Run by scripts/rhino-check.ts as a single-file source program:
 *   java -cp rhino.jar test/rhino/RhinoCheck.java stub.js bundle.js scenario.js
 */
public class RhinoCheck {
	public static void main(String[] args) throws Exception {
		ContextFactory factory = new ContextFactory();
		Context cx = factory.enter();
		ScriptableObject scope = cx.initStandardObjects();
		for (String file : args) {
			Path path = Path.of(file);
			cx.evaluateString(scope, Files.readString(path), path.getFileName().toString(), 1, null);
		}
		System.out.println("ok");
	}
}
