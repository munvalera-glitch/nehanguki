with open("src/ImmigrationMVP.jsx", "r") as f:
    content = f.read()

content = content.replace("""                                        setUser(updatedUser);
      }
                                        userRef.current = updatedUser;
                                      }""", """                                        setUser(updatedUser);
                                        userRef.current = updatedUser;
                                      }""")

with open("src/ImmigrationMVP.jsx", "w") as f:
    f.write(content)
