import java.net.URI;
import java.nio.file.FileSystem;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.jar.JarFile;

/**
 * Opens the release jar the two ways the game does and checks what KubeLoader reads from it:
 * java.util.jar.JarFile for contentpacks/contentpack.json (ModContentPackProvider), and a zip
 * file system for the server_scripts folder (ModContentPack). Also checks NeoForge's metadata is
 * there and that the script inside is byte-identical to the built one.
 *
 *   java test/jar/JarCheck.java dist/deleted-on-death-x.jar build/contentpack/server_scripts/deleted-on-death.js
 */
public class JarCheck {
	static void check(boolean condition, String message) {
		if (!condition) throw new IllegalStateException("jar-check: " + message);
	}

	public static void main(String[] args) throws Exception {
		Path jar = Path.of(args[0]).toAbsolutePath();
		Path built = Path.of(args[1]);
		String script = built.getFileName().toString();

		try (JarFile file = new JarFile(jar.toFile())) {
			var meta = file.getEntry("contentpacks/contentpack.json");
			check(meta != null && !meta.isDirectory(), "contentpacks/contentpack.json is a file");
			check(file.getEntry("META-INF/neoforge.mods.toml") != null, "META-INF/neoforge.mods.toml present");
			check(file.getEntry("pack.mcmeta") != null, "pack.mcmeta present");
		}

		try (FileSystem fs = FileSystems.newFileSystem(URI.create("jar:" + jar.toUri()), Map.of())) {
			Path scripts = fs.getPath("/", "contentpacks", "server_scripts");
			check(Files.isDirectory(scripts), "/contentpacks/server_scripts is a directory");
			byte[] inJar = Files.readAllBytes(scripts.resolve(script));
			check(java.util.Arrays.equals(inJar, Files.readAllBytes(built)), script + " matches the build");
			String toml = Files.readString(fs.getPath("/META-INF/neoforge.mods.toml"));
			check(toml.contains("modLoader = \"lowcodefml\""), "lowcodefml loader");
		}
		System.out.println("ok");
	}
}
